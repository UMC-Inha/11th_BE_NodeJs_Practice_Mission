// 7주차 로그인·인증·인가 실제 동작 기록: 빌드된 서버(node dist/main.js)를 PORT 3100 에 실제로 띄워
// 진짜 HTTP 요청을 보내고, 요청·상태·응답을 evidence/week07-api-results.json 에 남긴다.
// "일회용 테스트 DB(umc_movie_test_verify7)" 에서만 돌고 끝나면 지운다. 개발용 umc_movie 는 건드리지 않는다.
// JWT 서명 부분은 증거 파일에 남기지 않는다(header·payload 는 읽을 수 있게 둔다).
// npm run verify:week07
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import {
  PORT,
  adminConnection,
  createDisposableDb,
  dropDisposableDb,
  maskTokens,
  startServer,
  toMaskedJson,
} from './lib/live.mjs';

const DB = 'umc_movie_test_verify7';
const admin = await adminConnection();
await createDisposableDb(admin, DB);
const server = await startServer({ dbName: DB });
const { base } = server;
const results = [];

/** 이름 그대로 응답 본문을 JSON 으로 읽을 수 있으면 읽고, 비어 있으면 null. */
async function call(label, method, path, status, { body, token, verify } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token !== undefined) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  assert.equal(response.status, status, `${label}: ${text}`);
  verify?.(data, text);
  results.push({
    label,
    method,
    url: path,
    authorization: token === undefined ? null : `Bearer ${token}`,
    request: body ?? null,
    status: response.status,
    response: data,
  });
  return data;
}

const fail = (code, message) => ({
  isSuccess: false,
  code,
  message,
  result: null,
});
const decode = (segment) =>
  JSON.parse(Buffer.from(segment, 'base64url').toString());
const user = (n) => ({
  email: `viewer${n}@umc.com`,
  password: 'Umc!1234',
  nickname: `뷰어${n}`,
});

/** 토큰 segment 의 position 번째 글자를 "다른 글자로 교체"한다. 덧붙이지 않는다. */
function replaceChar(token, segment, position) {
  const parts = token.split('.');
  const target = parts[segment];
  const swapped = target[position] === 'A' ? 'B' : 'A';
  parts[segment] =
    target.slice(0, position) + swapped + target.slice(position + 1);
  return parts.join('.');
}

try {
  // ── 1. 준비: 6주차 회원가입 API 로 A, B 를 가입시킨다 ───────────────
  const a = user(1);
  const b = user(2);
  const signA = await call('1단계 회원 A 가입 201', 'POST', '/members', 201, {
    body: a,
    verify: (d, t) => {
      assert.equal(d.code, 'COMMON201');
      assert.ok(!t.includes('password'));
    },
  });
  const signB = await call('1단계 회원 B 가입 201', 'POST', '/members', 201, {
    body: b,
  });
  const aId = signA.result.memberId;
  const bId = signB.result.memberId;

  // ── 2. 로그인: 토큰 A, 토큰 B ─────────────────────────────────────
  const loginA = await call(
    '2단계 회원 A 로그인 200 (accessToken 발급)',
    'POST',
    '/auth/login',
    200,
    {
      body: { email: a.email, password: a.password },
      verify: (d) => {
        assert.equal(d.code, 'COMMON200');
        assert.deepEqual(Object.keys(d.result), ['nickname', 'accessToken']);
        assert.equal(d.result.accessToken.split('.').length, 3);
      },
    },
  );
  const loginB = await call(
    '2단계 회원 B 로그인 200',
    'POST',
    '/auth/login',
    200,
    {
      body: { email: b.email, password: b.password },
    },
  );
  const tokenA = loginA.result.accessToken;
  const tokenB = loginB.result.accessToken;

  // jwt.io 에 붙여 넣어 보는 것과 같은 확인: payload 는 누구나 읽을 수 있다
  const [headerA, payloadA] = tokenA.split('.');
  const claims = decode(payloadA);
  assert.deepEqual(decode(headerA), { alg: 'HS256', typ: 'JWT' });
  assert.equal(claims.sub, String(aId));
  assert.equal(claims.email, a.email);
  assert.equal(claims.exp - claims.iat, 3600);
  assert.ok(!JSON.stringify(claims).includes(a.password));
  results.push({
    label:
      '2단계 토큰 A 를 디코드해 본 결과 (jwt.io 와 같은 확인, 서명은 가림)',
    method: 'DECODE',
    url: 'accessToken.split(".")[0..1] → base64url 디코드',
    authorization: null,
    request: null,
    status: null,
    response: {
      header: decode(headerA),
      payload: claims,
      validForSeconds: claims.exp - claims.iat,
    },
  });

  // ── 로그인 실패: 없는 이메일과 틀린 비밀번호는 같은 응답 ──────────────
  const wrongPassword = await call(
    '로그인 실패: 틀린 비밀번호 401 (AUTH401_1)',
    'POST',
    '/auth/login',
    401,
    {
      body: { email: a.email, password: 'Wrong!1234' },
      verify: (d) =>
        assert.deepEqual(
          d,
          fail('AUTH401_1', '이메일 또는 비밀번호가 올바르지 않습니다.'),
        ),
    },
  );
  const unknownEmail = await call(
    '로그인 실패: 가입하지 않은 이메일 401 (AUTH401_1)',
    'POST',
    '/auth/login',
    401,
    {
      body: { email: 'nobody@umc.com', password: 'Umc!1234' },
      verify: (d) =>
        assert.deepEqual(
          d,
          fail('AUTH401_1', '이메일 또는 비밀번호가 올바르지 않습니다.'),
        ),
    },
  );
  assert.deepEqual(unknownEmail, wrongPassword);
  results.push({
    label: '로그인 실패 두 응답이 완전히 같은지 비교',
    method: 'COMPARE',
    url: '틀린 비밀번호 응답 vs 가입하지 않은 이메일 응답',
    authorization: null,
    request: null,
    status: null,
    response: {
      identicalBody: true,
      code: unknownEmail.code,
      message: unknownEmail.message,
    },
  });

  // 응답 시간 차이(참고용): 없는 이메일에도 bcrypt 비교를 하므로 두 경우가 비슷해야 한다
  async function timeLogin(body) {
    const started = performance.now();
    const response = await fetch(`${base}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    await response.text();
    return performance.now() - started;
  }
  const median = (values) =>
    [...values].sort((x, y) => x - y)[Math.floor(values.length / 2)];
  const wrongTimes = [];
  const unknownTimes = [];
  for (let i = 0; i < 9; i += 1) {
    wrongTimes.push(
      await timeLogin({ email: a.email, password: 'Wrong!1234' }),
    );
    unknownTimes.push(
      await timeLogin({ email: 'nobody@umc.com', password: 'Wrong!1234' }),
    );
  }
  results.push({
    label: '(참고) 틀린 비밀번호 vs 없는 이메일 응답 시간 (각 9회 중앙값, ms)',
    method: 'TIMING',
    url: 'POST /auth/login',
    authorization: null,
    request: null,
    status: null,
    response: {
      wrongPasswordMedianMs: Math.round(median(wrongTimes)),
      unknownEmailMedianMs: Math.round(median(unknownTimes)),
      note: '없는 이메일에도 bcrypt 비교를 한 번 하므로 두 값이 비슷하다. 이 값은 머신마다 다르다.',
    },
  });

  await call('로그인 입력 검증: 이메일 형식 400', 'POST', '/auth/login', 400, {
    body: { email: 'umc-example.com', password: 'Umc!1234' },
    verify: (d) =>
      assert.deepEqual(
        d,
        fail('COMMON400', '이메일 형식이 올바르지 않습니다.'),
      ),
  });

  // ── 인증 관문: GET /members/me ────────────────────────────────────
  await call(
    'GET /members/me 토큰 없이 → 401 (AUTH401_2)',
    'GET',
    '/members/me',
    401,
    {
      verify: (d) =>
        assert.deepEqual(d, fail('AUTH401_2', '로그인이 필요한 요청입니다.')),
    },
  );
  await call(
    'GET /members/me 올바른 토큰 → 200 내 정보',
    'GET',
    '/members/me',
    200,
    {
      token: tokenA,
      verify: (d, t) => {
        assert.deepEqual(Object.keys(d.result), [
          'email',
          'nickname',
          'createdAt',
        ]);
        assert.equal(d.result.email, a.email);
        assert.ok(!t.includes('password'));
      },
    },
  );
  const tamperedPayload = replaceChar(tokenA, 1, 12);
  await call(
    'GET /members/me payload 의 글자 하나를 다른 글자로 교체 → 401 (AUTH401_3)',
    'GET',
    '/members/me',
    401,
    {
      token: tamperedPayload,
      verify: (d) =>
        assert.deepEqual(d, fail('AUTH401_3', '유효하지 않은 토큰입니다.')),
    },
  );
  assert.notEqual(tamperedPayload, tokenA);
  assert.equal(tamperedPayload.length, tokenA.length);
  // 참고: 덧붙이기도 이 서버(jsonwebtoken)에서는 거절된다
  const appended = await fetch(`${base}/members/me`, {
    headers: { Authorization: `Bearer ${tokenA}A` },
  });
  results.push({
    label:
      '(참고) 토큰 맨 뒤에 글자를 "덧붙이기"만 해도 이 서버에서는 거절된다',
    method: 'GET',
    url: '/members/me',
    authorization: `Bearer ${tokenA}A`,
    request: null,
    status: appended.status,
    response: await appended.json(),
  });

  // ── PATCH /members/me ─────────────────────────────────────────────
  await call('PATCH /members/me 닉네임 변경 200', 'PATCH', '/members/me', 200, {
    token: tokenA,
    body: { nickname: '영화광' },
    verify: (d) => assert.equal(d.result.nickname, '영화광'),
  });
  await call(
    'PATCH /members/me 다른 회원의 닉네임이면 409 (MEMBER409_1)',
    'PATCH',
    '/members/me',
    409,
    {
      token: tokenB,
      body: { nickname: '영화광' },
      verify: (d) =>
        assert.deepEqual(
          d,
          fail('MEMBER409_1', '이미 사용 중인 닉네임입니다.'),
        ),
    },
  );
  await call(
    'PATCH /members/me 내 닉네임 그대로면 중복이 아니다 200',
    'PATCH',
    '/members/me',
    200,
    {
      token: tokenA,
      body: { nickname: '영화광' },
    },
  );

  // ── 3. 등록: 토큰 A 로 POST /ratings (요청 Body 에 memberId 없음) ─────
  const ratingBody = { movieId: 550, score: 5, comment: '최고의 영화!' };
  assert.ok(!('memberId' in ratingBody));
  const created = await call(
    '3단계 평점 등록 201 (토큰 A, Body 에 memberId 없음)',
    'POST',
    '/ratings',
    201,
    {
      token: tokenA,
      body: ratingBody,
      verify: (d) => {
        assert.equal(d.code, 'COMMON201');
        assert.equal(typeof d.result.ratingId, 'number');
        assert.deepEqual(Object.keys(d.result), [
          'ratingId',
          'movieId',
          'score',
          'comment',
          'createdAt',
          'updatedAt',
        ]);
      },
    },
  );
  const ratingId = created.result.ratingId;
  await call(
    '등록 요청 Body 에 memberId 를 넣으면 400 (서버가 받지 않는다)',
    'POST',
    '/ratings',
    400,
    {
      token: tokenA,
      body: { movieId: 155, score: 4, memberId: bId },
      verify: (d) => assert.equal(d.code, 'COMMON400'),
    },
  );

  // ── 4. 중복 등록 409 ────────────────────────────────────────────
  await call(
    '4단계 같은 movieId 중복 등록 409 (RATING409_1)',
    'POST',
    '/ratings',
    409,
    {
      token: tokenA,
      body: { movieId: 550, score: 3 },
      verify: (d) =>
        assert.deepEqual(
          d,
          fail('RATING409_1', '이미 이 영화에 평점을 남기셨습니다.'),
        ),
    },
  );

  // ── 5. 본인 수정 200 ────────────────────────────────────────────
  await call(
    '5단계 본인 수정 200 (토큰 A)',
    'PATCH',
    `/ratings/${ratingId}`,
    200,
    {
      token: tokenA,
      body: { score: 2, comment: '다시 보니 별로' },
      verify: (d) => {
        assert.equal(d.result.score, 2);
        assert.equal(d.result.ratingId, ratingId);
      },
    },
  );

  // ── 6. 남의 것 수정 403 (토큰만 B) ───────────────────────────────
  const forbidden = await call(
    '6단계 남의 평점 수정 → 403 (토큰 B, RATING403_1)',
    'PATCH',
    `/ratings/${ratingId}`,
    403,
    {
      token: tokenB,
      body: { score: 1 },
      verify: (d) =>
        assert.deepEqual(
          d,
          fail(
            'RATING403_1',
            '본인이 작성한 평점만 수정하거나 삭제할 수 있습니다.',
          ),
        ),
    },
  );

  // ── 7. 토큰 없이 401 ────────────────────────────────────────────
  const unauthorized = await call(
    '7단계 토큰 없이 수정 → 401 (AUTH401_2)',
    'PATCH',
    `/ratings/${ratingId}`,
    401,
    {
      body: { score: 1 },
      verify: (d) =>
        assert.deepEqual(d, fail('AUTH401_2', '로그인이 필요한 요청입니다.')),
    },
  );
  assert.notEqual(unauthorized.code, forbidden.code);
  results.push({
    label: '6단계(403)와 7단계(401)의 code 비교',
    method: 'COMPARE',
    url: '403 응답 vs 401 응답',
    authorization: null,
    request: null,
    status: null,
    response: {
      forbidden: { status: 403, code: forbidden.code },
      unauthorized: { status: 401, code: unauthorized.code },
      differentCode: true,
    },
  });

  // ── 8. 없는 평점 404 ────────────────────────────────────────────
  await call(
    '8단계 없는 평점 삭제 → 404 (토큰 A, RATING404_1)',
    'DELETE',
    '/ratings/99999',
    404,
    {
      token: tokenA,
      verify: (d) =>
        assert.deepEqual(
          d,
          fail('RATING404_1', '해당 평점을 찾을 수 없습니다.'),
        ),
    },
  );

  // ── 공개 조회는 토큰 없이 그대로 ─────────────────────────────────
  await call(
    '(공개 조회) 토큰 없이 A 의 평점 목록 200 — 5주차 그대로 배열',
    'GET',
    `/members/${aId}/ratings`,
    200,
    {
      verify: (d) => {
        assert.ok(Array.isArray(d));
        assert.equal(d.length, 1);
        assert.equal(d[0].score, 2);
      },
    },
  );

  // ── 6주차 memberId 경로는 사라졌다 ───────────────────────────────
  await call(
    '6주차 방식 POST /members/{memberId}/ratings → 404 (사라진 경로)',
    'POST',
    `/members/${aId}/ratings`,
    404,
    {
      token: tokenA,
      body: { movieId: 155, score: 3 },
      verify: (d) => assert.equal(d.code, 'COMMON404'),
    },
  );
  await call(
    '6주차 방식 DELETE /members/{memberId}/ratings/{ratingId} → 404',
    'DELETE',
    `/members/${aId}/ratings/${ratingId}`,
    404,
    {
      token: tokenA,
      verify: (d) => assert.equal(d.code, 'COMMON404'),
    },
  );

  // ── 9. 본인 삭제 200 ────────────────────────────────────────────
  await call(
    '9단계 본인 삭제 200 (토큰 A, result null)',
    'DELETE',
    `/ratings/${ratingId}`,
    200,
    {
      token: tokenA,
      verify: (d) =>
        assert.deepEqual(d, {
          isSuccess: true,
          code: 'COMMON200',
          message: '평점 삭제에 성공했습니다.',
          result: null,
        }),
    },
  );
  await call(
    '삭제 후 조회: 목록에서 사라짐',
    'GET',
    `/members/${aId}/ratings`,
    200,
    {
      verify: (d) => assert.deepEqual(d, []),
    },
  );

  // ── DB 에는 해시만 있다 ─────────────────────────────────────────
  const [[stored]] = await admin.query(
    `SELECT LEFT(password, 4) AS prefix, CHAR_LENGTH(password) AS length FROM \`${DB}\`.member WHERE member_id = ?`,
    [aId],
  );
  assert.equal(stored.prefix, '$2b$');
  assert.equal(Number(stored.length), 60);
  results.push({
    label:
      'DB 확인: member.password 는 bcrypt 해시 (원문·해시 전체는 기록하지 않음)',
    method: 'SQL',
    url: 'SELECT LEFT(password,4), CHAR_LENGTH(password) FROM member',
    authorization: null,
    request: null,
    status: null,
    response: {
      prefix: stored.prefix,
      length: Number(stored.length),
      isPlainText: false,
    },
  });

  const serverText = server.logs.join('');
  assert.ok(
    !/eyJ[\w-]+\.[\w-]+\.[\w-]+/.test(serverText),
    '서버 로그에 토큰이 찍혔다',
  );

  await mkdir('evidence', { recursive: true });
  await writeFile(
    'evidence/week07-api-results.json',
    toMaskedJson({
      checkedAt: new Date().toISOString(),
      database: DB,
      server: `node dist/main.js (PORT ${PORT}, 이 실행에서만 쓰는 무작위 JWT 키)`,
      note: 'accessToken 의 서명 부분은 <signature masked> 로 가렸다.',
      results,
    }),
  );
  console.log(
    `${results.length}개 확인 완료 → evidence/week07-api-results.json`,
  );
  assert.ok(
    !maskTokens(JSON.stringify(results)).match(
      /eyJ[\w-]+\.[\w-]+\.(?!<signature)/,
    ),
  );
} finally {
  await server.stop();
  await dropDisposableDb(admin, DB);
  await admin.end();
}
