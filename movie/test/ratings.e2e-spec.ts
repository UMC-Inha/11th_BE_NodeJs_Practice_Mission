import request from 'supertest';
import { Fixture, createFixture } from './support/app-fixture.js';

/**
 * 9주차 필수 미션: 평점 API 통합 테스트 2개.
 *
 * 진짜 요청이 인증(AuthGuard) → 입력 검증 → Service → MySQL 까지 전부 실제로 지나간다.
 * 테스트마다 "상황(given) → 실행(when) → 확인(then)" 순서로 적고, 이름만 읽어도 무엇을 확인하는지 알 수 있게 한다.
 * (평점의 더 많은 성공·실패 상황 — 400·403·404·409·동시 요청 — 은 members-write.e2e-spec.ts 에 있다.)
 */
describe('평점 API 통합 테스트 — 9주차 필수 미션 (격리된 테스트 DB)', () => {
  let f: Fixture;

  beforeAll(async () => {
    f = await createFixture('umc_movie_test_ratings');
  });

  afterAll(async () => {
    await f.close();
  });

  it('토큰 없이 POST /ratings 를 부르면 401 AUTH401_2 이고 평점은 저장되지 않는다', async () => {
    // given: 로그인한 회원이 있지만, 이 요청에는 Authorization 헤더를 붙이지 않는다
    const member = await f.signUpAndLogin();

    // when
    const res = await request(f.server())
      .post('/ratings')
      .send({ movieId: 238, score: 5, comment: '토큰 없이 보낸 요청' });

    // then: 401 이고, 같은 401 이라도 "토큰 없음" 을 뜻하는 code 다
    expect(res.status).toBe(401);
    expect(res.body).toEqual(
      f.failure('AUTH401_2', '로그인이 필요한 요청입니다.'),
    );
    // 실패한 요청이 흔적을 남기지 않았다 (DB 를 직접 센다)
    expect(
      await f.ratings.count({
        where: { member: { memberId: member.memberId } },
      }),
    ).toBe(0);
  });

  it('토큰을 담아 POST /ratings 를 부르면 201 이고 result 에 만들어진 평점이 있으며 DB 에 한 행이 저장된다', async () => {
    // given: 로그인해서 토큰을 받은 회원, 아직 평점이 없다
    const member = await f.signUpAndLogin();

    // when: Body 에 memberId 없이, 토큰만 담아 보낸다
    const res = await request(f.server())
      .post('/ratings')
      .set('Authorization', f.bearer(member.token))
      .send({ movieId: 238, score: 5, comment: '다시 보고 싶은 영화입니다.' });

    // then
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      isSuccess: true,
      code: 'COMMON201',
      message: '평점 등록에 성공했습니다.',
      result: {
        ratingId: expect.any(Number),
        movieId: 238,
        score: 5,
        comment: '다시 보고 싶은 영화입니다.',
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      },
    });
    // 작성자는 요청이 아니라 토큰이 정했다: 이 회원의 평점으로 DB 에 한 행이 있다
    const saved = await f.ratings.find({
      where: { member: { memberId: member.memberId } },
    });
    expect(saved).toHaveLength(1);
    expect(saved[0].movieId).toBe(238);
    expect(saved[0].ratingId).toBe(res.body.result.ratingId);
  });
});
