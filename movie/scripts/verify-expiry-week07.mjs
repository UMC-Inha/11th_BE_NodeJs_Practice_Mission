// 7주차 선택 미션 1: 토큰 만료를 직접 겪어 보기.
// JWT_ACCESS_EXPIRATION=60(초)으로 서버(node dist/main.js, PORT 3100)를 띄우고
// 로그인 → (만료 전) /members/me 200 → 60초가 지날 때까지 기다림 → 같은 토큰으로 다시 호출 → 401 AUTH401_4
// 토큰이 아예 없을 때의 AUTH401_2 와 code 가 다른 것도 함께 기록한다. 결과는 evidence/week07-expiry.json.
// 일회용 DB(umc_movie_test_expiry7)만 쓰고 끝나면 지운다. JWT 서명은 가려서 저장한다. 약 65초 걸린다.
// npm run verify:expiry
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import {
  PORT,
  adminConnection,
  createDisposableDb,
  dropDisposableDb,
  startServer,
  toMaskedJson,
} from './lib/live.mjs';

const DB = 'umc_movie_test_expiry7';
const EXPIRATION_SECONDS = 60;
const admin = await adminConnection();
await createDisposableDb(admin, DB);
const server = await startServer({
  dbName: DB,
  accessExpiration: String(EXPIRATION_SECONDS),
});
const { base } = server;

async function send(method, path, { body, token } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token !== undefined) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(base + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

const decode = (segment) =>
  JSON.parse(Buffer.from(segment, 'base64url').toString());
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

try {
  const user = {
    email: 'expiry@umc.com',
    password: 'Umc!1234',
    nickname: '만료체험',
  };
  assert.equal((await send('POST', '/members', { body: user })).status, 201);

  const loggedInAt = Date.now();
  const login = await send('POST', '/auth/login', {
    body: { email: user.email, password: user.password },
  });
  assert.equal(login.status, 200);
  const token = login.body.result.accessToken;
  const payload = decode(token.split('.')[1]);
  assert.equal(payload.exp - payload.iat, EXPIRATION_SECONDS);

  // 1) 만료 전: 같은 토큰으로 성공
  const beforeAt = Date.now();
  const before = await send('GET', '/members/me', { token });
  assert.equal(before.status, 200);

  // 2) 토큰이 아예 없을 때(비교용)
  const missing = await send('GET', '/members/me');
  assert.equal(missing.status, 401);
  assert.equal(missing.body.code, 'AUTH401_2');

  // 3) exp(서명된 만료 시각) 이후까지 기다린다
  const waitUntil = payload.exp * 1000 + 1500;
  console.log(
    `토큰 유효시간 ${EXPIRATION_SECONDS}초. ${Math.ceil((waitUntil - Date.now()) / 1000)}초 기다립니다...`,
  );
  while (Date.now() < waitUntil) {
    await sleep(Math.min(10_000, waitUntil - Date.now()));
    console.log(
      `  ...로그인 후 ${Math.round((Date.now() - loggedInAt) / 1000)}초 경과`,
    );
  }

  // 4) 만료 후: 같은 토큰
  const afterAt = Date.now();
  const after = await send('GET', '/members/me', { token });
  assert.equal(after.status, 401);
  assert.deepEqual(after.body, {
    isSuccess: false,
    code: 'AUTH401_4',
    message: '토큰이 만료되었습니다. 다시 로그인해주세요.',
    result: null,
  });
  assert.equal(after.status, missing.status);
  assert.notEqual(after.body.code, missing.body.code);

  // 5) 다시 로그인하면 새 토큰으로 다시 된다 ("다시 로그인해주세요" 안내대로)
  const relogin = await send('POST', '/auth/login', {
    body: { email: user.email, password: user.password },
  });
  assert.equal(relogin.status, 200);
  const again = await send('GET', '/members/me', {
    token: relogin.body.result.accessToken,
  });
  assert.equal(again.status, 200);

  const seconds = (at) => Math.round(((at - loggedInAt) / 1000) * 10) / 10;
  await mkdir('evidence', { recursive: true });
  await writeFile(
    'evidence/week07-expiry.json',
    toMaskedJson({
      checkedAt: new Date().toISOString(),
      database: DB,
      server: `node dist/main.js (PORT ${PORT}, JWT_ACCESS_EXPIRATION=${EXPIRATION_SECONDS}, 이 실행에서만 쓰는 무작위 JWT 키)`,
      note: 'accessToken 의 서명 부분은 <signature masked> 로 가렸다.',
      token: {
        accessToken: token,
        payload,
        validForSeconds: payload.exp - payload.iat,
      },
      beforeExpiry: {
        secondsAfterLogin: seconds(beforeAt),
        request: 'GET /members/me (Authorization: Bearer 위 토큰)',
        status: before.status,
        response: before.body,
      },
      noToken: {
        request: 'GET /members/me (Authorization 헤더 없음)',
        status: missing.status,
        response: missing.body,
      },
      afterExpiry: {
        secondsAfterLogin: seconds(afterAt),
        request: 'GET /members/me (Authorization: Bearer 같은 토큰)',
        status: after.status,
        response: after.body,
      },
      sameStatusDifferentCode: {
        status: after.status,
        expiredCode: after.body.code,
        noTokenCode: missing.body.code,
      },
      afterRelogin: {
        request: '다시 로그인해서 받은 새 토큰으로 GET /members/me',
        status: again.status,
      },
    }),
  );
  console.log(
    `만료 전 ${before.status} → 만료 후 ${after.status} ${after.body.code} (토큰 없음은 ${missing.body.code}) → evidence/week07-expiry.json`,
  );
} finally {
  await server.stop();
  await dropDisposableDb(admin, DB);
  await admin.end();
}
