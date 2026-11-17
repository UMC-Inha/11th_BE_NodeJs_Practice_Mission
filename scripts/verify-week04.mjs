import 'reflect-metadata';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../dist/app.module.js';
import { createValidationPipe } from '../dist/validation.js';
const app = await NestFactory.create(AppModule, { logger: false });
app.useGlobalPipes(createValidationPipe());
await app.listen(0, '127.0.0.1');
const base = await app.getUrl();
const results = [];
async function check(label, method, path, body, status, verify = () => {}) {
  const response = await fetch(base + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  assert.equal(response.status, status, label + ': ' + JSON.stringify(data));
  verify(data);
  results.push({
    label,
    method,
    url: path,
    request: body ?? null,
    status: response.status,
    response: data,
  });
}
try {
  const title = `스프링 ORM 실습 ${Date.now()}`;
  const initial = await (await fetch(base + '/books')).json();
  const categoryId = 1;
  await check('전체 목록과 응답 DTO', 'GET', '/books', null, 200, (data) => {
    assert.ok(data.length > 0);
    assert.deepEqual(Object.keys(data[0]), [
      'bookId',
      'title',
      'description',
      'categoryName',
      'isAvailable',
    ]);
    assert.equal(typeof data[0].isAvailable, 'boolean');
    for (let i = 1; i < data.length; i++)
      assert.ok(BigInt(data[i - 1].bookId) > BigInt(data[i].bookId));
  });
  await check(
    '도서 등록',
    'POST',
    '/books',
    { categoryId, title, description: '4주차 ORM 검증' },
    201,
    (data) => {
      assert.equal(data.title, title);
      assert.equal(data.isAvailable, true);
    },
  );
  await check('등록 후 최신순 확인', 'GET', '/books', null, 200, (data) => {
    assert.equal(data[0].title, title);
    assert.equal(data.length, initial.length + 1);
  });
  await check(
    '제목 검색',
    'GET',
    '/books?keyword=' + encodeURIComponent(title),
    null,
    200,
    (data) => {
      assert.equal(data.length, 1);
      assert.equal(data[0].title, title);
    },
  );
  await check(
    '검색 결과 없음',
    'GET',
    '/books?keyword=존재하지않는검색결과1234567890',
    null,
    200,
    (data) => assert.deepEqual(data, []),
  );
  await check(
    '와일드카드는 문자로 검색',
    'GET',
    '/books?keyword=%25',
    null,
    200,
    (data) => assert.ok(data.every((book) => book.title.includes('%'))),
  );
  await check(
    '중복 도서 등록 차단',
    'POST',
    '/books',
    { categoryId, title },
    409,
  );
  await check('빈 제목 차단', 'POST', '/books', { categoryId, title: '' }, 400);
  await check(
    '공백 제목 차단',
    'POST',
    '/books',
    { categoryId, title: '   ' },
    400,
  );
  await check('제목 누락', 'POST', '/books', { categoryId }, 400);
  await check(
    '101자 제목',
    'POST',
    '/books',
    { categoryId, title: '가'.repeat(101) },
    400,
  );
  await check(
    '문자열 카테고리 차단',
    'POST',
    '/books',
    { categoryId: '1', title: '잘못된 타입' },
    400,
  );
  await check(
    '카테고리 0 차단',
    'POST',
    '/books',
    { categoryId: 0, title: '잘못된 번호' },
    400,
  );
  await check(
    '없는 카테고리',
    'POST',
    '/books',
    { categoryId: 999999, title: '없는 카테고리' },
    404,
  );
  await check(
    '알 수 없는 필드 차단',
    'POST',
    '/books',
    { categoryId, title: '오타', titel: '오타' },
    400,
  );
  await check(
    'description 타입 오류',
    'POST',
    '/books',
    { categoryId, title: '설명 타입 오류', description: 1 },
    400,
  );
  await check(
    'description 생략',
    'POST',
    '/books',
    { categoryId, title: title + ' 설명 없음' },
    201,
    (data) => assert.equal(data.description, null),
  );
  await check('기존 카테고리 조회 유지', 'GET', '/books/category/1', null, 200);
  await check('잘못된 Path Parameter', 'GET', '/books/category/abc', null, 400);
  // 동시에 두 번 저장해도 UNIQUE 제약 조건이 최종적으로 한 건만 허용한다.
  const concurrentTitle = title + ' 동시 요청';
  const responses = await Promise.all(
    [1, 2].map(() =>
      fetch(base + '/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId, title: concurrentTitle }),
      }),
    ),
  );
  const statuses = responses.map((r) => r.status).sort();
  assert.deepEqual(statuses, [201, 409]);
  results.push({
    label: '동시 중복 등록',
    status: statuses,
    response: '한 건만 저장됨',
  });
  await mkdir('evidence', { recursive: true });
  await writeFile(
    'evidence/week04-api-results.json',
    JSON.stringify(results, null, 2),
  );
  console.log(
    `${results.length}개 실제 HTTP/MySQL 검증 성공. evidence/week04-api-results.json`,
  );
} finally {
  await app.close();
}
