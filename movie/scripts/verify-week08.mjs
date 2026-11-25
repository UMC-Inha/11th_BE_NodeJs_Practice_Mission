// 8주차 즐겨찾기·영화 기록(트랜잭션) 실제 동작 기록: 빌드된 서버(node dist/main.js)를 PORT 3100 에 실제로 띄워
// 진짜 HTTP 요청을 보내고, 요청·상태·응답과 그때그때의 DB 행 수를 evidence/week08-api-results.json 에 남긴다.
// "일회용 테스트 DB(umc_movie_test_verify8)" 에서만 돌고 끝나면 지운다. 개발용 umc_movie 는 건드리지 않는다.
// 롤백 증명은 DB 트리거로 "첫 저장은 성공하고 둘째 저장만 실패하는" 상황을 만들어서 실제 MySQL 이 되돌리는지 본다.
// JWT 서명 부분은 증거 파일에 남기지 않는다(header·payload 는 읽을 수 있게 둔다).
// npm run verify:week08
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

const DB = 'umc_movie_test_verify8';
const admin = await adminConnection();
await createDisposableDb(admin, DB);
const server = await startServer({ dbName: DB });
const { base } = server;
const results = [];

/** 이 회원이 이 영화에 가진 평점·즐겨찾기 행 수 (DB 를 직접 센다) */
async function rows(memberId, movieId) {
  const [[r]] = await admin.query(
    `SELECT (SELECT COUNT(*) FROM \`${DB}\`.rating   WHERE member_id = ? AND movie_id = ?) AS rating,
            (SELECT COUNT(*) FROM \`${DB}\`.favorite WHERE member_id = ? AND movie_id = ?) AS favorite`,
    [memberId, movieId, memberId, movieId],
  );
  return { rating: Number(r.rating), favorite: Number(r.favorite) };
}

async function rawCall(method, path, { body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token !== undefined) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return {
    response,
    text,
    data: text ? JSON.parse(text) : null,
  };
}

/** 요청을 보내 상태를 확인하고 결과(요청·응답·DB 행 수)를 증거에 쌓는다. */
async function call(label, method, path, status, opts = {}) {
  const { body, token, verify, db } = opts;
  const { response, text, data } = await rawCall(method, path, {
    body,
    token,
  });
  assert.equal(response.status, status, `${label}: ${text}`);
  verify?.(data, text);
  const entry = {
    label,
    method,
    url: path,
    authorization: token === undefined ? null : `Bearer ${token}`,
    request: body ?? null,
    status: response.status,
    response: data,
  };
  if (db) entry.dbRows = await db();
  results.push(entry);
  return data;
}

const note = (label, detail) =>
  results.push({ label, method: 'NOTE', url: null, ...detail });

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

async function withTrigger(name, ddl, run) {
  await admin.query(`DROP TRIGGER IF EXISTS \`${DB}\`.${name}`);
  await admin.query(ddl);
  try {
    return await run();
  } finally {
    await admin.query(`DROP TRIGGER IF EXISTS \`${DB}\`.${name}`);
  }
}

try {
  // ── 준비: 회원 A, B 가입·로그인 (7주차 API) ─────────────────────────
  const a = user(1);
  const b = user(2);
  const signA = await call('준비 회원 A 가입 201', 'POST', '/members', 201, {
    body: a,
  });
  const signB = await call('준비 회원 B 가입 201', 'POST', '/members', 201, {
    body: b,
  });
  const aId = signA.result.memberId;
  const bId = signB.result.memberId;
  const tokenA = (
    await call('준비 회원 A 로그인 200', 'POST', '/auth/login', 200, {
      body: { email: a.email, password: a.password },
    })
  ).result.accessToken;
  const tokenB = (
    await call('준비 회원 B 로그인 200', 'POST', '/auth/login', 200, {
      body: { email: b.email, password: b.password },
    })
  ).result.accessToken;

  // ── 1. 즐겨찾기 (워크북 Postman 시나리오) ────────────────────────────
  await call(
    'F0 토큰 없이 POST /favorites → 401 AUTH401_2',
    'POST',
    '/favorites',
    401,
    {
      body: { movieId: 550 },
      verify: (d) =>
        assert.deepEqual(d, fail('AUTH401_2', '로그인이 필요한 요청입니다.')),
    },
  );

  const created = await call(
    'F1 즐겨찾기 등록 201 (토큰 A, Body 에 memberId 없음)',
    'POST',
    '/favorites',
    201,
    {
      token: tokenA,
      body: { movieId: 550 },
      verify: (d, t) => {
        assert.equal(d.code, 'COMMON201');
        assert.equal(d.message, '즐겨찾기를 등록했습니다.');
        assert.deepEqual(Object.keys(d.result), [
          'favoriteId',
          'movieId',
          'createdAt',
        ]);
        assert.ok(!t.includes('password'));
      },
    },
  );

  await call(
    'F2 같은 영화를 한 번 더 → 409 FAVORITE409_1',
    'POST',
    '/favorites',
    409,
    {
      token: tokenA,
      body: { movieId: 550 },
      verify: (d) =>
        assert.deepEqual(
          d,
          fail('FAVORITE409_1', '이미 이 영화를 즐겨찾기하셨습니다.'),
        ),
    },
  );

  await call(
    'F3 내 즐겨찾기 목록 200 (방금 저장한 영화 1개)',
    'GET',
    '/favorites',
    200,
    {
      token: tokenA,
      verify: (d) => {
        assert.equal(d.result.length, 1);
        assert.deepEqual(d.result[0], created.result);
      },
    },
  );

  await call(
    'F4 GET /favorites/550 → isFavorite: true',
    'GET',
    '/favorites/550',
    200,
    {
      token: tokenA,
      verify: (d) =>
        assert.deepEqual(d, {
          isSuccess: true,
          code: 'COMMON200',
          message: '즐겨찾기 여부를 조회했습니다.',
          result: { isFavorite: true },
        }),
    },
  );

  await call(
    'F5 DELETE /favorites/550 → 200, result null',
    'DELETE',
    '/favorites/550',
    200,
    {
      token: tokenA,
      verify: (d) =>
        assert.deepEqual(d, {
          isSuccess: true,
          code: 'COMMON200',
          message: '즐겨찾기를 해제했습니다.',
          result: null,
        }),
    },
  );

  await call(
    'F6 다시 GET /favorites/550 → isFavorite: false (정상 상태)',
    'GET',
    '/favorites/550',
    200,
    {
      token: tokenA,
      verify: (d) => assert.deepEqual(d.result, { isFavorite: false }),
    },
  );

  await call('F7 빈 목록 GET /favorites → 200 []', 'GET', '/favorites', 200, {
    token: tokenA,
    verify: (d) => assert.deepEqual(d.result, []),
  });

  await call(
    'F8 없던 즐겨찾기 해제 → 404 FAVORITE404_1',
    'DELETE',
    '/favorites/123456',
    404,
    {
      token: tokenA,
      verify: (d) =>
        assert.deepEqual(
          d,
          fail('FAVORITE404_1', '즐겨찾기한 영화를 찾을 수 없습니다.'),
        ),
    },
  );

  await call('F9 movieId 0 → 400 COMMON400', 'POST', '/favorites', 400, {
    token: tokenA,
    body: { movieId: 0 },
    verify: (d) =>
      assert.deepEqual(d, fail('COMMON400', '영화 ID는 양수여야 합니다.')),
  });

  await call(
    'F10 Body 에 memberId 를 몰래 넣으면 → 400',
    'POST',
    '/favorites',
    400,
    {
      token: tokenA,
      body: { movieId: 31, memberId: bId },
      verify: (d) =>
        assert.equal(d.message, 'property memberId should not exist'),
    },
  );

  // 내 것만 다룬다: A 는 100, 200 / B 는 200
  for (const movieId of [100, 200]) {
    await call(`F11 회원 A 즐겨찾기 ${movieId}`, 'POST', '/favorites', 201, {
      token: tokenA,
      body: { movieId },
    });
  }
  await call('F11 회원 B 즐겨찾기 200', 'POST', '/favorites', 201, {
    token: tokenB,
    body: { movieId: 200 },
  });
  await call(
    'F12 회원 A 목록: 내 것만, 최신 등록 순(200 → 100)',
    'GET',
    '/favorites',
    200,
    {
      token: tokenA,
      verify: (d) =>
        assert.deepEqual(
          d.result.map((x) => x.movieId),
          [200, 100],
        ),
    },
  );
  await call('F13 회원 B 목록: 내 것만(200 하나)', 'GET', '/favorites', 200, {
    token: tokenB,
    verify: (d) =>
      assert.deepEqual(
        d.result.map((x) => x.movieId),
        [200],
      ),
  });
  await call(
    'F14 회원 B 가 A 의 영화(100)를 해제하려 하면 → 404 (남의 것을 건드리지 못한다)',
    'DELETE',
    '/favorites/100',
    404,
    {
      token: tokenB,
      verify: (d) => assert.equal(d.code, 'FAVORITE404_1'),
    },
  );

  // ── 2. 영화 기록 (평점 + 즐겨찾기, 한 트랜잭션) ──────────────────────
  const rec = await call(
    'R1 POST /movie-records (평점 + 즐겨찾기) → 201, rating 과 favorite 이 함께',
    'POST',
    '/movie-records',
    201,
    {
      token: tokenA,
      body: {
        movieId: 238,
        score: 5,
        comment: '다시 보고 싶은 영화입니다.',
        addToFavorites: true,
      },
      db: () => rows(aId, 238),
      verify: (d) => {
        assert.equal(d.message, '영화 기록을 저장했습니다.');
        assert.equal(d.result.rating.movieId, 238);
        assert.equal(d.result.favorite.movieId, 238);
      },
    },
  );
  assert.deepEqual(results.at(-1).dbRows, { rating: 1, favorite: 1 });

  await call(
    'R2 같은 요청을 다시 → 409 RATING409_1, 평점·즐겨찾기 행이 늘지 않는다',
    'POST',
    '/movie-records',
    409,
    {
      token: tokenA,
      body: {
        movieId: 238,
        score: 5,
        comment: '두 번째',
        addToFavorites: true,
      },
      db: () => rows(aId, 238),
      verify: (d) =>
        assert.deepEqual(
          d,
          fail('RATING409_1', '이미 이 영화에 평점을 남기셨습니다.'),
        ),
    },
  );
  assert.deepEqual(results.at(-1).dbRows, { rating: 1, favorite: 1 });

  await call(
    'R3 addToFavorites false → 201, favorite 은 null (즐겨찾기 행 0)',
    'POST',
    '/movie-records',
    201,
    {
      token: tokenA,
      body: { movieId: 155, score: 4, addToFavorites: false },
      db: () => rows(aId, 155),
      verify: (d) => {
        assert.equal(d.result.favorite, null);
        assert.equal(d.result.rating.movieId, 155);
      },
    },
  );
  assert.deepEqual(results.at(-1).dbRows, { rating: 1, favorite: 0 });

  await call(
    'R4 즐겨찾기가 이미 있는 영화(100)에 addToFavorites true → 409 FAVORITE409_1, 평점도 저장되지 않는다',
    'POST',
    '/movie-records',
    409,
    {
      token: tokenA,
      body: { movieId: 100, score: 3, addToFavorites: true },
      db: () => rows(aId, 100),
      verify: (d) =>
        assert.deepEqual(
          d,
          fail('FAVORITE409_1', '이미 이 영화를 즐겨찾기하셨습니다.'),
        ),
    },
  );
  assert.deepEqual(results.at(-1).dbRows, { rating: 0, favorite: 1 });

  await call(
    'R5 별점 6 → 400 (아무것도 저장되지 않는다)',
    'POST',
    '/movie-records',
    400,
    {
      token: tokenA,
      body: { movieId: 77, score: 6, addToFavorites: true },
      db: () => rows(aId, 77),
      verify: (d) =>
        assert.deepEqual(d, fail('COMMON400', '별점은 5점 이하여야 합니다.')),
    },
  );
  assert.deepEqual(results.at(-1).dbRows, { rating: 0, favorite: 0 });

  await call('R6 토큰 없이 → 401 AUTH401_2', 'POST', '/movie-records', 401, {
    body: { movieId: 1, score: 3, addToFavorites: true },
    verify: (d) => assert.equal(d.code, 'AUTH401_2'),
  });

  // ── 3. 트랜잭션 증명: 둘째 저장이 실패하면 첫째 저장도 취소된다 ───────
  const rollback = await withTrigger(
    'block_favorite_insert',
    `CREATE TRIGGER \`${DB}\`.block_favorite_insert BEFORE INSERT ON \`${DB}\`.favorite
       FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '강제로 만든 즐겨찾기 저장 실패'`,
    async () => {
      await call(
        'T1 [DB 트리거: favorite INSERT 만 실패] POST /movie-records → 500, 먼저 저장한 평점도 되돌려진다',
        'POST',
        '/movie-records',
        500,
        {
          token: tokenA,
          body: { movieId: 9001, score: 5, addToFavorites: true },
          db: () => rows(aId, 9001),
          verify: (d, t) => {
            assert.equal(d.code, 'COMMON500');
            assert.ok(
              !t.includes('강제로 만든'),
              '내부 메시지가 응답에 새면 안 된다',
            );
          },
        },
      );
      return results.at(-1).dbRows;
    },
  );
  assert.deepEqual(rollback, { rating: 0, favorite: 0 });
  note('T1 해석', {
    detail:
      '평점 INSERT 는 이미 성공한 뒤에 즐겨찾기 INSERT 가 실패했다. 그런데도 rating 행이 0 인 것이 rollback 이다. (트랜잭션 없이 두 Service 를 연달아 부르면 rating 1행만 남는다는 것은 test/movie-records.e2e-spec.ts 가 같은 트리거로 보여 준다.)',
  });

  await withTrigger(
    'race_favorite_after_rating',
    `CREATE TRIGGER \`${DB}\`.race_favorite_after_rating AFTER INSERT ON \`${DB}\`.rating
       FOR EACH ROW INSERT INTO \`${DB}\`.favorite (member_id, movie_id) VALUES (NEW.member_id, NEW.movie_id)`,
    async () => {
      await call(
        'T2 [DB 트리거: 평점이 저장되는 순간 다른 요청이 같은 즐겨찾기를 넣은 경쟁 재현] → 409 FAVORITE409_1, 평점·즐겨찾기 모두 취소',
        'POST',
        '/movie-records',
        409,
        {
          token: tokenA,
          body: { movieId: 9003, score: 4, addToFavorites: true },
          db: () => rows(aId, 9003),
          verify: (d) => assert.equal(d.code, 'FAVORITE409_1'),
        },
      );
    },
  );
  assert.deepEqual(results.at(-1).dbRows, { rating: 0, favorite: 0 });

  // ── 4. UNIQUE: 사전 검사를 통과해도 DB 가 막는다 ──────────────────────
  const concurrent = await Promise.all(
    Array.from({ length: 8 }, () =>
      rawCall('POST', '/favorites', { token: tokenA, body: { movieId: 4242 } }),
    ),
  );
  const statuses = concurrent
    .map((c) => c.response.status)
    .sort((x, y) => x - y);
  assert.deepEqual(statuses, [201, 409, 409, 409, 409, 409, 409, 409]);
  for (const c of concurrent.filter((x) => x.response.status === 409)) {
    assert.equal(c.data.code, 'FAVORITE409_1');
  }
  results.push({
    label:
      'U1 같은 영화를 동시에 8번 즐겨찾기 → 정확히 1건 201, 나머지 7건 409 FAVORITE409_1',
    method: 'POST ×8 (동시)',
    url: '/favorites',
    authorization: `Bearer ${tokenA}`,
    request: { movieId: 4242 },
    status: statuses,
    response: concurrent.find((x) => x.response.status === 201).data,
    dbRows: await rows(aId, 4242),
  });
  assert.deepEqual(results.at(-1).dbRows, { rating: 0, favorite: 1 });

  const dupSql = await admin
    .query(
      `INSERT INTO \`${DB}\`.favorite (member_id, movie_id) VALUES (?, ?)`,
      [aId, 4242],
    )
    .then(
      () => null,
      (e) => ({ code: e.code, sqlMessage: e.sqlMessage }),
    );
  assert.equal(dupSql.code, 'ER_DUP_ENTRY');
  assert.ok(dupSql.sqlMessage.includes('uk_favorite_member_movie'));
  results.push({
    label:
      'U2 [서비스를 거치지 않고 SQL 로 직접] 같은 (member_id, movie_id) 를 또 넣으면 DB UNIQUE 가 거부',
    method: 'SQL',
    url: 'INSERT INTO favorite (member_id, movie_id) VALUES (?, ?)',
    authorization: null,
    request: { member_id: aId, movie_id: 4242 },
    status: null,
    response: dupSql,
  });

  // ── 개발용 DB 는 건드리지 않았다 / 서버 로그에 토큰이 없다 ─────────────
  const serverText = server.logs.join('');
  assert.ok(
    !/eyJ[\w-]+\.[\w-]+\.[\w-]+/.test(serverText),
    '서버 로그에 토큰이 찍혔다',
  );

  await mkdir('evidence', { recursive: true });
  await writeFile(
    'evidence/week08-api-results.json',
    toMaskedJson({
      checkedAt: new Date().toISOString(),
      database: DB,
      server: `node dist/main.js (PORT ${PORT}, 이 실행에서만 쓰는 무작위 JWT 키)`,
      note: 'accessToken 의 서명 부분은 <signature masked> 로 가렸다. dbRows 는 그 요청 직후 일회용 DB 에서 직접 센 행 수다.',
      results,
    }),
  );
  console.log(
    `${results.length}개 확인 완료 → evidence/week08-api-results.json`,
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
