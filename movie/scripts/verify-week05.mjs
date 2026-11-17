// 5주차 API 실제 동작 기록: 빌드된 앱을 실제 MySQL(umc_movie)에 붙여 요청을 보내고
// 요청·상태·응답·CORS 헤더를 evidence/week05-api-results.json 에 남긴다. 조회만 하므로 DB를 바꾸지 않는다.
// npm run build && node --env-file=.env scripts/verify-week05.mjs
import 'reflect-metadata';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../dist/app.module.js';
import { configureApp } from '../dist/app.setup.js';

const allowed = 'http://localhost:5173';
const app = await NestFactory.create(AppModule, { logger: false });
configureApp(app, [allowed]);
await app.listen(0, '127.0.0.1');
const base = await app.getUrl();
const results = [];

async function check(label, path, status, verify = () => {}, init = {}) {
  const response = await fetch(base + path, init);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  assert.equal(response.status, status, `${label}: ${text}`);
  verify(data, response.headers);
  results.push({
    label,
    method: init.method ?? 'GET',
    url: path,
    requestOrigin: init.headers?.Origin ?? null,
    status: response.status,
    accessControlAllowOrigin:
      response.headers.get('access-control-allow-origin') ?? null,
    response: data,
  });
}

const nick = (value) => `/members/nickname/${encodeURIComponent(value)}`;

try {
  await check('닉네임 중복(수현)', nick('수현'), 200, (d) =>
    assert.deepEqual(d, { available: false }),
  );
  await check('닉네임 사용 가능(케빈)', nick('케빈'), 200, (d) =>
    assert.deepEqual(d, { available: true }),
  );
  await check('이메일 중복', '/members/email/noco@umc.com', 200, (d) =>
    assert.deepEqual(d, { available: false }),
  );
  await check('이메일 사용 가능', '/members/email/kevin@umc.com', 200, (d) =>
    assert.deepEqual(d, { available: true }),
  );
  await check('1번 회원 평점 최신순', '/members/1/ratings', 200, (d) => {
    assert.deepEqual(
      d.map((r) => r.ratingId),
      [2, 1],
    );
    assert.equal(typeof d[0].movieId, 'number');
  });
  await check('2번 회원 평점', '/members/2/ratings', 200, (d) =>
    assert.equal(d.length, 1),
  );
  await check('없는 회원', '/members/999/ratings', 404);
  await check('숫자 아닌 회원 ID', '/members/abc/ratings', 400);
  await check('(선택) 닉네임 1자', nick('수'), 400);
  await check('(선택) 닉네임 13자', nick('가'.repeat(13)), 400);
  await check('(선택) 이메일 형식 오류', '/members/email/noco-umc.com', 400);
  await check(
    '(선택) 페이지 0, 크기 1',
    '/members/1/ratings?page=0&size=1',
    200,
    (d) =>
      assert.deepEqual(
        d.map((r) => r.ratingId),
        [2],
      ),
  );
  await check(
    '(선택) 페이지 1, 크기 1',
    '/members/1/ratings?page=1&size=1',
    200,
    (d) =>
      assert.deepEqual(
        d.map((r) => r.ratingId),
        [1],
      ),
  );
  await check(
    '(선택) 페이지 범위 밖',
    '/members/1/ratings?page=5&size=10',
    200,
    (d) => assert.deepEqual(d, []),
  );
  await check('(선택) size=0 거부', '/members/1/ratings?size=0', 400);
  await check(
    'CORS 허용 출처',
    nick('noco'),
    200,
    (_d, h) => assert.equal(h.get('access-control-allow-origin'), allowed),
    { headers: { Origin: allowed } },
  );
  await check(
    'CORS 허용 안 된 출처 (서버는 200, 브라우저가 차단)',
    nick('noco'),
    200,
    (_d, h) => assert.equal(h.get('access-control-allow-origin'), null),
    { headers: { Origin: 'http://localhost:8081' } },
  );
  await check(
    'CORS 사전 요청(OPTIONS)',
    '/members/1/ratings',
    204,
    (_d, h) => assert.match(h.get('access-control-allow-methods') ?? '', /GET/),
    {
      method: 'OPTIONS',
      headers: {
        Origin: allowed,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'content-type',
      },
    },
  );

  await mkdir('evidence', { recursive: true });
  await writeFile(
    'evidence/week05-api-results.json',
    JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2) +
      '\n',
  );
  console.log(
    `${results.length}개 요청 확인 완료 → evidence/week05-api-results.json`,
  );
} finally {
  await app.close();
}
