import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { Repository } from 'typeorm';
import { AppModule } from '../../src/app.module.js';
import { configureApp } from '../../src/app.setup.js';
import { Member } from '../../src/entity/member.entity.js';
import { Rating } from '../../src/entity/rating.entity.js';
import { createTestDatabase, dropTestDatabase } from './test-database.js';

export const ALLOWED_ORIGIN = 'http://localhost:5173';

export interface TestUser {
  email: string;
  password: string;
  nickname: string;
  memberId: number;
  token: string;
}

/**
 * 일회용 테스트 DB 를 만들고 실제 AppModule(JwtModule·AuthGuard 포함)을 띄운다.
 * 파일마다 자기 DB 이름을 넘겨서, 병렬로 도는 e2e 파일끼리 DB 를 지우고 만드는 일이 겹치지 않게 한다.
 */
export async function createFixture(dbName: string) {
  await createTestDatabase(dbName);
  const originalDbName = process.env.DB_NAME;
  // AppModule 의 TypeORM 설정이 모듈을 만들 때 DB_NAME 을 읽으므로, 그 전에 바꾼다.
  process.env.DB_NAME = dbName;

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app: INestApplication<App> = moduleRef.createNestApplication();
  configureApp(app, [ALLOWED_ORIGIN]);
  await app.init();

  const server = () => app.getHttpServer();
  const members: Repository<Member> = app.get(getRepositoryToken(Member));
  const ratings: Repository<Rating> = app.get(getRepositoryToken(Rating));
  const jwt = app.get(JwtService);
  let seq = 0;

  /** 테스트마다 겹치지 않는 가입 요청 값 */
  function newUser() {
    seq += 1;
    return {
      email: `user${seq}@test.dev`,
      password: 'Umc!1234',
      nickname: `유저${seq}`,
    };
  }

  const post = (path: string, body: object) =>
    request(server()).post(path).send(body);

  /** 회원가입 후 로그인까지 해서 토큰을 가진 테스트 회원을 만든다. */
  async function signUpAndLogin(): Promise<TestUser> {
    const user = newUser();
    const signUp = await post('/members', user).expect(201);
    const login = await post('/auth/login', {
      email: user.email,
      password: user.password,
    }).expect(200);
    return {
      ...user,
      memberId: signUp.body.result.memberId as number,
      token: login.body.result.accessToken as string,
    };
  }

  const bearer = (token: string) => `Bearer ${token}`;

  /** 이 회원의 토큰으로 평점을 등록하고 ratingId 를 돌려준다. */
  async function addRating(
    user: TestUser,
    movieId: number,
    score = 4,
    comment?: string,
  ): Promise<number> {
    const res = await request(server())
      .post('/ratings')
      .set('Authorization', bearer(user.token))
      .send({ movieId, score, ...(comment === undefined ? {} : { comment }) })
      .expect(201);
    return res.body.result.ratingId as number;
  }

  /** 공개 조회 API(5주차)로 평점 목록을 본다. 토큰이 필요 없다. */
  const listRatings = async (memberId: number) =>
    (await request(server()).get(`/members/${memberId}/ratings`).expect(200))
      .body as Array<{
      ratingId: number;
      movieId: number;
      score: number;
      comment: string | null;
    }>;

  const failure = (code: string, message?: string) => ({
    isSuccess: false,
    code,
    message: message ?? expect.any(String),
    result: null,
  });

  async function close() {
    await app.close();
    await dropTestDatabase(dbName);
    if (originalDbName === undefined) delete process.env.DB_NAME;
    else process.env.DB_NAME = originalDbName;
  }

  return {
    app,
    server,
    members,
    ratings,
    jwt,
    newUser,
    post,
    bearer,
    signUpAndLogin,
    addRating,
    listRatings,
    failure,
    close,
  };
}

export type Fixture = Awaited<ReturnType<typeof createFixture>>;
