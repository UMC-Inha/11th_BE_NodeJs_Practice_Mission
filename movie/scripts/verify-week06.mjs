// 6주차 쓰기 API 실제 동작 기록: 빌드된 앱을 실제 MySQL 의 "일회용 테스트 DB(umc_movie_test)" 에 붙여
// 진짜 HTTP 요청을 보내고, 요청·상태·응답을 evidence/week06-api-results.json 에 남긴다.
// 개발용 umc_movie 는 건드리지 않는다. 끝나면 테스트 DB 를 지운다.
// npm run build && node --env-file=.env scripts/verify-week06.mjs
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';

const TEST_DB = 'umc_movie_test';
const sqlFile = async (name) =>
  (
    await readFile(new URL(`../sql/${name}`, import.meta.url), 'utf8')
  ).replaceAll('umc_movie', TEST_DB);

const dbConfig = {
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  multipleStatements: true,
};

const admin = await mysql.createConnection(dbConfig);
await admin.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
await admin.query(await sqlFile('schema.sql'));
await admin.query(await sqlFile('seed.sql'));

// AppModule 의 TypeORM 설정이 앱을 만들 때 DB_NAME 을 읽는다.
process.env.DB_NAME = TEST_DB;
const { NestFactory } = await import('@nestjs/core');
const { AppModule } = await import('../dist/app.module.js');
const { configureApp } = await import('../dist/app.setup.js');

// 서버 경고 로그를 모아 "DB UNIQUE 제약 위반을 409 로 변환했습니다" 횟수를 센다.
const warnings = [];
const logger = {
  log() {},
  error() {},
  debug() {},
  verbose() {},
  fatal() {},
  warn: (message) => warnings.push(String(message)),
};
const app = await NestFactory.create(AppModule, { logger });
configureApp(app, ['http://localhost:5173']);
await app.listen(0, '127.0.0.1');
const base = await app.getUrl();
const results = [];

async function call(label, method, path, status, body, verify = () => {}) {
  const response = await fetch(base + path, {
    method,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  assert.equal(response.status, status, `${label}: ${text}`);
  verify(data, text);
  results.push({
    label,
    method,
    url: path,
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
const user = (n) => ({
  email: `viewer${n}@umc.com`,
  password: 'Umc!1234',
  nickname: `뷰어${n}`,
});
const patch = (id, ratingId) => `/members/${id}/ratings/${ratingId}`;

try {
  // ── 회원가입 ──────────────────────────────────────────────
  const a = user(1);
  const signUp = await call(
    '회원가입 성공 201',
    'POST',
    '/members',
    201,
    a,
    (d, t) => {
      assert.equal(d.code, 'COMMON201');
      assert.deepEqual(Object.keys(d.result), [
        'memberId',
        'email',
        'nickname',
      ]);
      assert.ok(!t.includes('password'), '응답에 password 가 섞여 있다');
    },
  );
  const aId = signUp.result.memberId;

  const [[stored]] = await admin.query(
    `SELECT LEFT(password, 4) AS prefix, CHAR_LENGTH(password) AS length,
            password = ? AS isPlain FROM \`${TEST_DB}\`.member WHERE member_id = ?`,
    [a.password, aId],
  );
  assert.equal(Number(stored.isPlain), 0);
  assert.equal(Number(stored.length), 60);
  results.push({
    label:
      'DB 확인: member.password 는 bcrypt 해시 (원문·해시 전체는 기록하지 않음)',
    method: 'SQL',
    url: 'SELECT LEFT(password,4), CHAR_LENGTH(password) FROM member',
    request: null,
    status: null,
    response: {
      prefix: stored.prefix,
      length: Number(stored.length),
      isPlainText: false,
    },
  });

  await call(
    '검증 실패: 이메일 형식 400',
    'POST',
    '/members',
    400,
    { ...user(2), email: 'umc-example.com' },
    (d) =>
      assert.deepEqual(d, fail('COMMON400', '올바른 이메일 형식이 아닙니다.')),
  );
  await call(
    '검증 실패: 비밀번호 규칙 400',
    'POST',
    '/members',
    400,
    { ...user(2), password: 'umc1234' },
    (d) => assert.equal(d.code, 'COMMON400'),
  );
  await call(
    '검증 실패: 닉네임 1자 400',
    'POST',
    '/members',
    400,
    { ...user(2), nickname: 'a' },
    (d) => assert.equal(d.code, 'COMMON400'),
  );
  await call(
    '이메일 중복 409 (MEMBER4091)',
    'POST',
    '/members',
    409,
    { ...user(2), email: a.email },
    (d) =>
      assert.deepEqual(d, fail('MEMBER4091', '이미 사용 중인 이메일입니다.')),
  );
  await call(
    '닉네임 중복 409 (MEMBER4092)',
    'POST',
    '/members',
    409,
    { ...user(2), nickname: a.nickname },
    (d) =>
      assert.deepEqual(d, fail('MEMBER4092', '이미 사용 중인 닉네임입니다.')),
  );

  // ── (선택) DB UNIQUE 제약 위반 재현: 같은 이메일로 동시에 8번 ──────
  const before = warnings.length;
  const raceEmail = 'race@umc.com';
  const race = await Promise.all(
    Array.from({ length: 8 }, (_, i) =>
      fetch(base + '/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: raceEmail,
          password: 'Umc!1234',
          nickname: `경주${i}`,
        }),
      }).then(async (r) => ({ status: r.status, body: await r.json() })),
    ),
  );
  const statuses = race.map((r) => r.status).sort((x, y) => x - y);
  assert.deepEqual(statuses, [201, 409, 409, 409, 409, 409, 409, 409]);
  for (const r of race.filter((x) => x.status === 409)) {
    assert.deepEqual(
      r.body,
      fail('MEMBER4091', '이미 사용 중인 이메일입니다.'),
    );
  }
  const [[{ cnt }]] = await admin.query(
    `SELECT COUNT(*) AS cnt FROM \`${TEST_DB}\`.member WHERE email = ?`,
    [raceEmail],
  );
  assert.equal(Number(cnt), 1);
  const converted = warnings
    .slice(before)
    .filter((w) => w.includes('DB UNIQUE'));
  assert.ok(
    converted.length >= 1,
    '사전 체크를 통과해 DB 제약에 걸린 요청이 없다',
  );
  results.push({
    label: '(선택) 같은 이메일 동시 8요청 → DB UNIQUE 위반 재현',
    method: 'POST',
    url: '/members ×8 (동시)',
    request: { email: raceEmail, password: '(Umc!1234)', nickname: '경주0~7' },
    status: null,
    response: {
      statuses,
      memberRowsWithThatEmail: Number(cnt),
      dbConstraintConvertedTo409: converted.length,
      sampleServerWarning: converted[0],
      sample409Body: race.find((x) => x.status === 409).body,
    },
  });

  // ── 평점 등록 / 수정 / 삭제 ────────────────────────────────
  const bUser = user(3);
  const b = await call('(다른 회원) 가입', 'POST', '/members', 201, bUser);
  const bId = b.result.memberId;

  const created = await call(
    '평점 등록 201',
    'POST',
    `/members/${aId}/ratings`,
    201,
    { movieId: 550, score: 5, comment: '최고의 영화!' },
    (d) => {
      assert.equal(d.code, 'COMMON201');
      assert.equal(typeof d.result, 'number');
    },
  );
  const ratingId = created.result;

  await call(
    '같은 영화 중복 등록 409 (RATING4091)',
    'POST',
    `/members/${aId}/ratings`,
    409,
    { movieId: 550, score: 3 },
    (d) =>
      assert.deepEqual(
        d,
        fail('RATING4091', '이미 이 영화에 평점을 남기셨습니다.'),
      ),
  );
  await call(
    '별점 범위 오류 400',
    'POST',
    `/members/${aId}/ratings`,
    400,
    { movieId: 155, score: 6 },
    (d) =>
      assert.deepEqual(d, fail('COMMON400', '별점은 5점 이하여야 합니다.')),
  );
  await call(
    '후기 501자 400',
    'POST',
    `/members/${aId}/ratings`,
    400,
    { movieId: 155, score: 5, comment: 'a'.repeat(501) },
    (d) => assert.equal(d.code, 'COMMON400'),
  );
  await call(
    '없는 회원에게 등록 404',
    'POST',
    '/members/999999/ratings',
    404,
    { movieId: 550, score: 5 },
    (d) => assert.deepEqual(d, fail('MEMBER4041', '존재하지 않는 유저입니다.')),
  );

  await call(
    '평점 수정 200',
    'PATCH',
    patch(aId, ratingId),
    200,
    { score: 2, comment: '다시 보니 별로' },
    (d) =>
      assert.deepEqual(d, {
        isSuccess: true,
        code: 'COMMON200',
        message: '평점 수정에 성공했습니다.',
        result: null,
      }),
  );
  await call(
    '수정 결과를 5주차 조회 API 로 확인',
    'GET',
    `/members/${aId}/ratings`,
    200,
    undefined,
    (d) => {
      assert.equal(d.length, 1);
      assert.equal(d[0].score, 2);
      assert.equal(d[0].comment, '다시 보니 별로');
    },
  );
  await call(
    '다른 회원이 수정 시도 403 (RATING4031)',
    'PATCH',
    patch(bId, ratingId),
    403,
    { score: 1 },
    (d) => assert.equal(d.code, 'RATING4031'),
  );
  await call(
    '없는 ratingId 수정 404 (RATING4041)',
    'PATCH',
    patch(aId, 999999),
    404,
    { score: 3 },
    (d) => assert.deepEqual(d, fail('RATING4041', '존재하지 않는 평점입니다.')),
  );
  await call(
    '다른 회원이 삭제 시도 403',
    'DELETE',
    patch(bId, ratingId),
    403,
    undefined,
    (d) => assert.equal(d.code, 'RATING4031'),
  );
  await call(
    '평점 삭제 204 (본문 없음)',
    'DELETE',
    patch(aId, ratingId),
    204,
    undefined,
    (d, t) => assert.equal(t, ''),
  );
  await call(
    '삭제 후 조회: 목록에서 사라짐',
    'GET',
    `/members/${aId}/ratings`,
    200,
    undefined,
    (d) => assert.deepEqual(d, []),
  );
  await call(
    '이미 삭제한 평점 다시 삭제 404',
    'DELETE',
    patch(aId, ratingId),
    404,
    undefined,
    (d) => assert.equal(d.code, 'RATING4041'),
  );

  // ── 5주차 조회 API 호환 (Flutter 가 쓰는 모양) ──────────────────
  await call(
    '조회 호환: 닉네임 확인 성공은 감싸지 않음',
    'GET',
    `/members/nickname/${encodeURIComponent(a.nickname)}`,
    200,
    undefined,
    (d) => assert.deepEqual(d, { available: false }),
  );
  await call(
    '조회 호환: 평점 목록 성공은 배열 그대로',
    'GET',
    '/members/1/ratings',
    200,
    undefined,
    (d) => assert.ok(Array.isArray(d)),
  );
  await call(
    '조회 호환: 없는 회원 404 는 실패 틀',
    'GET',
    '/members/999999/ratings',
    404,
    undefined,
    (d) => assert.deepEqual(d, fail('MEMBER4041', '존재하지 않는 유저입니다.')),
  );
  await call(
    '조회 호환: 숫자 아닌 memberId 400',
    'GET',
    '/members/abc/ratings',
    400,
    undefined,
    (d) => assert.equal(d.code, 'COMMON400'),
  );

  await mkdir('evidence', { recursive: true });
  await writeFile(
    'evidence/week06-api-results.json',
    JSON.stringify(
      { checkedAt: new Date().toISOString(), database: TEST_DB, results },
      null,
      2,
    ) + '\n',
  );
  console.log(
    `${results.length}개 확인 완료 → evidence/week06-api-results.json`,
  );
} finally {
  await app.close();
  await admin.query(`DROP DATABASE IF EXISTS \`${TEST_DB}\``);
  await admin.end();
}
