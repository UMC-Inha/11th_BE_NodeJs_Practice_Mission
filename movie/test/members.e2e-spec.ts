import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

/**
 * 실제 로컬 MySQL(umc_movie)에 sql/schema.sql + sql/seed.sql 을 넣은 상태에서 돈다.
 * 조회만 하므로 DB 내용을 바꾸지 않는다.
 */
describe('5주차 회원·평점 API (실제 DB)', () => {
  let app: INestApplication<App>;
  const allowed = 'http://localhost:5173';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, [allowed]);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  const server = () => app.getHttpServer();

  it('이미 쓰는 닉네임 수현 → available false', async () => {
    const res = await request(server())
      .get(`/members/nickname/${encodeURIComponent('수현')}`)
      .expect(200);
    expect(res.body).toEqual({ available: false });
  });

  it('새 닉네임 → available true', async () => {
    const res = await request(server())
      .get(`/members/nickname/${encodeURIComponent('케빈')}`)
      .expect(200);
    expect(res.body).toEqual({ available: true });
  });

  it('이메일 중복 / 사용 가능', async () => {
    await request(server())
      .get('/members/email/noco@umc.com')
      .expect(200, { available: false });
    await request(server())
      .get('/members/email/kevin@umc.com')
      .expect(200, { available: true });
  });

  it('1번 회원 평점 2건, ratingId 최신순, 숫자 ID', async () => {
    const res = await request(server()).get('/members/1/ratings').expect(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((r: { ratingId: number }) => r.ratingId)).toEqual([
      2, 1,
    ]);
    expect(res.body[0]).toMatchObject({
      ratingId: 2,
      movieId: 155,
      score: 4,
      comment: '다시 봐도 명작',
    });
    expect(Object.keys(res.body[0])).toEqual([
      'ratingId',
      'movieId',
      'score',
      'comment',
      'createdAt',
      'updatedAt',
    ]);
  });

  it('없는 회원 999 → 404, 숫자가 아닌 ID → 400', async () => {
    await request(server()).get('/members/999/ratings').expect(404);
    await request(server()).get('/members/abc/ratings').expect(400);
  });

  it('(선택) 형식이 틀리면 중복 확인 전에 400', async () => {
    await request(server()).get('/members/nickname/a').expect(400);
    await request(server())
      .get(`/members/nickname/${'가'.repeat(13)}`)
      .expect(400);
    await request(server())
      .get(`/members/nickname/${'가'.repeat(12)}`)
      .expect(200);
    await request(server()).get('/members/email/not-an-email').expect(400);
  });

  it('(선택) 페이지네이션 page=0&size=1, page=1&size=1', async () => {
    const first = await request(server())
      .get('/members/1/ratings?page=0&size=1')
      .expect(200);
    const second = await request(server())
      .get('/members/1/ratings?page=1&size=1')
      .expect(200);
    expect(first.body.map((r: { ratingId: number }) => r.ratingId)).toEqual([
      2,
    ]);
    expect(second.body.map((r: { ratingId: number }) => r.ratingId)).toEqual([
      1,
    ]);
    await request(server()).get('/members/1/ratings?size=0').expect(400);
    await request(server()).get('/members/1/ratings?page=-1').expect(400);
  });

  it('CORS: 허용한 출처에만 Access-Control-Allow-Origin 을 붙인다', async () => {
    const ok = await request(server())
      .get('/members/1/ratings')
      .set('Origin', allowed)
      .expect(200);
    expect(ok.headers['access-control-allow-origin']).toBe(allowed);

    // 서버는 요청을 처리(200)하지만, 허용 헤더가 없어서 브라우저가 응답을 막는다.
    const blocked = await request(server())
      .get('/members/1/ratings')
      .set('Origin', 'http://evil.example')
      .expect(200);
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  });
});
