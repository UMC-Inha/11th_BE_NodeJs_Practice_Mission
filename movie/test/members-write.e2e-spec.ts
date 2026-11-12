import bcrypt from 'bcrypt';
import request from 'supertest';
import {
  ALLOWED_ORIGIN,
  Fixture,
  createFixture,
} from './support/app-fixture.js';
import { TEST_DB_NAME } from './support/test-database.js';

/**
 * 쓰기 API(회원가입, 토큰으로 구분하는 평점 등록/수정/삭제)를 실제 MySQL 에서 검증한다.
 * 개발용 umc_movie 가 아니라 매번 새로 만드는 umc_movie_test 에서만 돈다.
 * (6주차에는 /members/{memberId}/ratings 였고, 7주차부터 /ratings + Authorization 헤더다.)
 */
describe('쓰기 API (격리된 테스트 DB)', () => {
  let f: Fixture;

  beforeAll(async () => {
    f = await createFixture(TEST_DB_NAME);
  });

  afterAll(async () => {
    await f.close();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('POST /members 회원가입', () => {
    it('201 + 회원 정보만, password 는 응답에 없고 DB 에는 bcrypt 해시만 있다', async () => {
      const user = f.newUser();
      const res = await f.post('/members', user).expect(201);

      expect(res.body).toEqual({
        isSuccess: true,
        code: 'COMMON201',
        message: '회원가입에 성공했습니다.',
        result: {
          memberId: expect.any(Number),
          email: user.email,
          nickname: user.nickname,
        },
      });
      expect(res.text).not.toContain('password');
      expect(res.text).not.toContain(user.password);

      const row = await f.members.findOneByOrFail({ email: user.email });
      expect(row.password).toHaveLength(60);
      expect(row.password).not.toBe(user.password);
      await expect(bcrypt.compare(user.password, row.password)).resolves.toBe(
        true,
      );
    });

    it('앞뒤 공백은 지우고 저장한다', async () => {
      const user = f.newUser();
      const res = await f
        .post('/members', {
          ...user,
          email: `  ${user.email}  `,
          nickname: ` ${user.nickname} `,
        })
        .expect(201);
      expect(res.body.result).toMatchObject({
        email: user.email,
        nickname: user.nickname,
      });
    });

    it('형식이 틀리면 400 COMMON400 이고 아무것도 저장하지 않는다', async () => {
      const before = await f.members.count();
      const cases: Array<[string, object]> = [
        ['이메일 형식', { ...f.newUser(), email: 'not-an-email' }],
        ['닉네임 1자', { ...f.newUser(), nickname: 'a' }],
        ['닉네임 13자', { ...f.newUser(), nickname: '가'.repeat(13) }],
        ['비밀번호 대문자 없음', { ...f.newUser(), password: 'umc!1234' }],
        ['비밀번호 특수문자 없음', { ...f.newUser(), password: 'Umc12345' }],
        ['비밀번호 8자 미만', { ...f.newUser(), password: 'Um!1234' }],
        ['빈 Body', {}],
      ];
      for (const [name, body] of cases) {
        const res = await f.post('/members', body);
        expect(res.status, name).toBe(400);
        expect(res.body, name).toEqual(f.failure('COMMON400'));
      }
      expect(await f.members.count()).toBe(before);
    });

    it('DTO 에 없는 값을 몰래 보내면 400 (forbidNonWhitelisted)', async () => {
      const res = await f
        .post('/members', { ...f.newUser(), role: 'admin' })
        .expect(400);
      expect(res.body).toEqual(
        f.failure('COMMON400', 'property role should not exist'),
      );
    });

    it('JSON 이 깨져도 같은 실패 형식으로 400', async () => {
      const res = await request(f.server())
        .post('/members')
        .set('Content-Type', 'application/json')
        .send('{"email": ')
        .expect(400);
      expect(res.body.isSuccess).toBe(false);
      expect(res.body.result).toBeNull();
    });

    it('이메일 중복 409 MEMBER409_2 / 닉네임 중복 409 MEMBER409_1, code 가 서로 다르다', async () => {
      const first = await f.signUpAndLogin();
      const before = await f.members.count();

      const emailDup = await f
        .post('/members', { ...f.newUser(), email: first.email })
        .expect(409);
      expect(emailDup.body).toEqual(
        f.failure('MEMBER409_2', '이미 사용 중인 이메일입니다.'),
      );

      const nicknameDup = await f
        .post('/members', { ...f.newUser(), nickname: first.nickname })
        .expect(409);
      expect(nicknameDup.body).toEqual(
        f.failure('MEMBER409_1', '이미 사용 중인 닉네임입니다.'),
      );

      expect(await f.members.count()).toBe(before);
    });
  });

  describe('(선택) 사전 중복 체크를 통과해도 DB UNIQUE 가 막는다', () => {
    it('같은 이메일로 동시에 8번 가입하면 정확히 1건만 201, 나머지는 409 MEMBER409_2', async () => {
      const email = f.newUser().email;
      const results = await Promise.all(
        Array.from({ length: 8 }, (_, i) =>
          f.post('/members', {
            email,
            password: 'Umc!1234',
            nickname: `동시${i}`,
          }),
        ),
      );

      const statuses = results.map((r) => r.status).sort((a, b) => a - b);
      expect(statuses).toEqual([201, 409, 409, 409, 409, 409, 409, 409]);
      for (const res of results.filter((r) => r.status === 409)) {
        expect(res.body).toEqual(f.failure('MEMBER409_2'));
      }
      expect(await f.members.countBy({ email })).toBe(1);
    });

    it('사전 확인이 "없다"고 잘못 답해도(경쟁 상황 재현) DB 제약 위반이 이메일 409 로 바뀐다', async () => {
      const existing = await f.signUpAndLogin();
      // 두 요청이 동시에 사전 확인을 통과한 순간을 만든다: exists 가 항상 false.
      vi.spyOn(f.members, 'exists').mockResolvedValue(false);

      const res = await f
        .post('/members', { ...f.newUser(), email: existing.email })
        .expect(409);
      expect(res.body).toEqual(
        f.failure('MEMBER409_2', '이미 사용 중인 이메일입니다.'),
      );
    });

    it('같은 방식으로 닉네임은 409 MEMBER409_1 로 바뀐다', async () => {
      const existing = await f.signUpAndLogin();
      vi.spyOn(f.members, 'exists').mockResolvedValue(false);

      const res = await f
        .post('/members', { ...f.newUser(), nickname: existing.nickname })
        .expect(409);
      expect(res.body).toEqual(
        f.failure('MEMBER409_1', '이미 사용 중인 닉네임입니다.'),
      );
    });
  });

  describe('POST /ratings 평점 등록 (토큰의 주인이 작성자)', () => {
    it('201 + result 는 만들어진 평점, 5주차 조회 API 에 바로 보인다', async () => {
      const owner = await f.signUpAndLogin();
      const res = await request(f.server())
        .post('/ratings')
        .set('Authorization', f.bearer(owner.token))
        .send({ movieId: 550, score: 5, comment: '최고의 영화!' })
        .expect(201);

      expect(res.body).toEqual({
        isSuccess: true,
        code: 'COMMON201',
        message: '평점 등록에 성공했습니다.',
        result: {
          ratingId: expect.any(Number),
          movieId: 550,
          score: 5,
          comment: '최고의 영화!',
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      });
      expect(Number.isNaN(Date.parse(res.body.result.createdAt))).toBe(false);
      expect(await f.listRatings(owner.memberId)).toEqual([
        expect.objectContaining({
          ratingId: res.body.result.ratingId,
          movieId: 550,
          score: 5,
          comment: '최고의 영화!',
        }),
      ]);
      // 응답에 작성자 정보(password 등)가 섞이지 않는다
      expect(res.text).not.toContain('password');
      expect(res.text).not.toContain(owner.email);
    });

    it('평점의 주인은 요청 Body 가 아니라 토큰으로 정해진다', async () => {
      const owner = await f.signUpAndLogin();
      const other = await f.signUpAndLogin();
      await f.addRating(owner, 550);

      expect(await f.listRatings(owner.memberId)).toHaveLength(1);
      expect(await f.listRatings(other.memberId)).toHaveLength(0);
    });

    it('Body 에 memberId 를 넣어 보내면 400 이고 저장하지 않는다', async () => {
      const owner = await f.signUpAndLogin();
      const other = await f.signUpAndLogin();
      const res = await request(f.server())
        .post('/ratings')
        .set('Authorization', f.bearer(owner.token))
        .send({ movieId: 550, score: 5, memberId: other.memberId })
        .expect(400);
      expect(res.body).toEqual(
        f.failure('COMMON400', 'property memberId should not exist'),
      );
      expect(await f.listRatings(other.memberId)).toHaveLength(0);
      expect(await f.listRatings(owner.memberId)).toHaveLength(0);
    });

    it('comment 는 생략할 수 있다 (null 로 저장)', async () => {
      const owner = await f.signUpAndLogin();
      await f.addRating(owner, 155, 4);
      expect((await f.listRatings(owner.memberId))[0].comment).toBeNull();
    });

    it('같은 영화에 한 번 더 등록하면 409 RATING409_1, DB 에는 1건만 남는다', async () => {
      const owner = await f.signUpAndLogin();
      await f.addRating(owner, 550);

      const res = await request(f.server())
        .post('/ratings')
        .set('Authorization', f.bearer(owner.token))
        .send({ movieId: 550, score: 1 })
        .expect(409);
      expect(res.body).toEqual(
        f.failure('RATING409_1', '이미 이 영화에 평점을 남기셨습니다.'),
      );
      expect(await f.listRatings(owner.memberId)).toHaveLength(1);
      // 다른 회원은 같은 영화에 평점을 남길 수 있다.
      const other = await f.signUpAndLogin();
      await f.addRating(other, 550);
    });

    it('동시에 같은 영화로 5번 등록해도 DB 에는 1건만, 나머지는 409', async () => {
      const owner = await f.signUpAndLogin();
      const results = await Promise.all(
        Array.from({ length: 5 }, () =>
          request(f.server())
            .post('/ratings')
            .set('Authorization', f.bearer(owner.token))
            .send({ movieId: 27205, score: 3 }),
        ),
      );
      expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
        201, 409, 409, 409, 409,
      ]);
      for (const res of results.filter((r) => r.status === 409)) {
        expect(res.body.code).toBe('RATING409_1');
      }
      expect(await f.ratings.countBy({ movieId: 27205 })).toBe(1);
    });

    it('사전 확인을 통과해도(경쟁 재현) DB UNIQUE 위반이 409 RATING409_1 로 바뀐다', async () => {
      const owner = await f.signUpAndLogin();
      await f.addRating(owner, 550);
      vi.spyOn(f.ratings, 'exists').mockResolvedValue(false);

      const res = await request(f.server())
        .post('/ratings')
        .set('Authorization', f.bearer(owner.token))
        .send({ movieId: 550, score: 2 })
        .expect(409);
      expect(res.body.code).toBe('RATING409_1');
      expect(await f.listRatings(owner.memberId)).toHaveLength(1);
    });

    it('별점·영화 ID·후기 형식이 틀리면 400 이고 저장하지 않는다', async () => {
      const owner = await f.signUpAndLogin();
      const bodies: Array<[string, object]> = [
        ['score 0', { movieId: 1, score: 0 }],
        ['score 6', { movieId: 1, score: 6 }],
        ['score 소수', { movieId: 1, score: 4.5 }],
        ['score 문자열', { movieId: 1, score: '5' }],
        ['score 없음', { movieId: 1 }],
        ['movieId 0', { movieId: 0, score: 5 }],
        ['movieId 없음', { score: 5 }],
        ['comment 501자', { movieId: 1, score: 5, comment: 'a'.repeat(501) }],
        ['모르는 필드', { movieId: 1, score: 5, role: 'admin' }],
      ];
      for (const [name, body] of bodies) {
        const res = await request(f.server())
          .post('/ratings')
          .set('Authorization', f.bearer(owner.token))
          .send(body);
        expect(res.status, name).toBe(400);
        expect(res.body, name).toEqual(f.failure('COMMON400'));
      }
      expect(await f.listRatings(owner.memberId)).toHaveLength(0);

      // 경계값은 통과: score 1·5, comment 500자
      await f.addRating(owner, 1, 1);
      await f.addRating(owner, 2, 5, 'a'.repeat(500));
    });

    it('토큰의 주인이 이미 없는 회원이면 404 MEMBER404_1', async () => {
      const ghost = await f.signUpAndLogin();
      await f.members.delete({ memberId: ghost.memberId });
      const res = await request(f.server())
        .post('/ratings')
        .set('Authorization', f.bearer(ghost.token))
        .send({ movieId: 550, score: 5 })
        .expect(404);
      expect(res.body).toEqual(
        f.failure('MEMBER404_1', '해당 회원을 찾을 수 없습니다.'),
      );
    });
  });

  describe('PATCH /ratings/{ratingId} 평점 수정', () => {
    it('200 + 수정된 평점을 돌려주고, 조회 API 에서도 바뀐 값이 보인다', async () => {
      const owner = await f.signUpAndLogin();
      const ratingId = await f.addRating(owner, 550, 5, '처음 후기');

      const res = await request(f.server())
        .patch(`/ratings/${ratingId}`)
        .set('Authorization', f.bearer(owner.token))
        .send({ score: 2, comment: '다시 보니 별로' })
        .expect(200);
      expect(res.body).toEqual({
        isSuccess: true,
        code: 'COMMON200',
        message: '평점 수정에 성공했습니다.',
        result: {
          ratingId,
          movieId: 550,
          score: 2,
          comment: '다시 보니 별로',
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
      });
      expect(await f.listRatings(owner.memberId)).toEqual([
        expect.objectContaining({
          ratingId,
          score: 2,
          comment: '다시 보니 별로',
        }),
      ]);
    });

    it('comment 를 생략하면 후기를 유지하고, null 을 보내면 지운다', async () => {
      const owner = await f.signUpAndLogin();
      const ratingId = await f.addRating(owner, 550, 5, '남길 후기');
      const patch = (body: object) =>
        request(f.server())
          .patch(`/ratings/${ratingId}`)
          .set('Authorization', f.bearer(owner.token))
          .send(body);

      const kept = await patch({ score: 3 }).expect(200);
      expect(kept.body.result.comment).toBe('남길 후기');
      expect((await f.listRatings(owner.memberId))[0]).toMatchObject({
        score: 3,
        comment: '남길 후기',
      });

      const cleared = await patch({ score: 3, comment: null }).expect(200);
      expect(cleared.body.result.comment).toBeNull();
      expect((await f.listRatings(owner.memberId))[0].comment).toBeNull();
    });

    it('별점 범위가 틀리면 400 이고 값은 그대로', async () => {
      const owner = await f.signUpAndLogin();
      const ratingId = await f.addRating(owner, 550, 4);
      for (const score of [0, 6, 2.5, 'x']) {
        await request(f.server())
          .patch(`/ratings/${ratingId}`)
          .set('Authorization', f.bearer(owner.token))
          .send({ score })
          .expect(400);
      }
      expect((await f.listRatings(owner.memberId))[0].score).toBe(4);
    });

    it('없는 ratingId 는 404 RATING404_1 (403 이 아니다)', async () => {
      const owner = await f.signUpAndLogin();
      const res = await request(f.server())
        .patch('/ratings/999999')
        .set('Authorization', f.bearer(owner.token))
        .send({ score: 3 })
        .expect(404);
      expect(res.body).toEqual(
        f.failure('RATING404_1', '해당 평점을 찾을 수 없습니다.'),
      );
    });

    it('다른 회원의 평점이면 403 RATING403_1 이고 바뀌지 않는다', async () => {
      const owner = await f.signUpAndLogin();
      const intruder = await f.signUpAndLogin();
      const ratingId = await f.addRating(owner, 550, 5, '내 후기');

      const res = await request(f.server())
        .patch(`/ratings/${ratingId}`)
        .set('Authorization', f.bearer(intruder.token))
        .send({ score: 1, comment: '해킹' })
        .expect(403);
      expect(res.body).toEqual(
        f.failure(
          'RATING403_1',
          '본인이 작성한 평점만 수정하거나 삭제할 수 있습니다.',
        ),
      );
      expect((await f.listRatings(owner.memberId))[0]).toMatchObject({
        score: 5,
        comment: '내 후기',
      });
    });

    it('ratingId 가 숫자가 아니면 400', async () => {
      const owner = await f.signUpAndLogin();
      await request(f.server())
        .patch('/ratings/abc')
        .set('Authorization', f.bearer(owner.token))
        .send({ score: 3 })
        .expect(400);
    });
  });

  describe('DELETE /ratings/{ratingId} 평점 삭제', () => {
    it('200 + result null (6주차의 204 에서 바뀜), 다시 조회하면 목록에서 사라진다', async () => {
      const owner = await f.signUpAndLogin();
      const keep = await f.addRating(owner, 155);
      const ratingId = await f.addRating(owner, 550);

      const res = await request(f.server())
        .delete(`/ratings/${ratingId}`)
        .set('Authorization', f.bearer(owner.token))
        .expect(200);
      expect(res.body).toEqual({
        isSuccess: true,
        code: 'COMMON200',
        message: '평점 삭제에 성공했습니다.',
        result: null,
      });

      expect(
        (await f.listRatings(owner.memberId)).map((r) => r.ratingId),
      ).toEqual([keep]);
    });

    it('이미 지운 평점을 또 지우면 404', async () => {
      const owner = await f.signUpAndLogin();
      const ratingId = await f.addRating(owner, 550);
      const del = () =>
        request(f.server())
          .delete(`/ratings/${ratingId}`)
          .set('Authorization', f.bearer(owner.token));
      await del().expect(200);
      const res = await del().expect(404);
      expect(res.body.code).toBe('RATING404_1');
    });

    it('다른 회원의 평점이면 403 이고 지워지지 않는다', async () => {
      const owner = await f.signUpAndLogin();
      const intruder = await f.signUpAndLogin();
      const ratingId = await f.addRating(owner, 550);

      const res = await request(f.server())
        .delete(`/ratings/${ratingId}`)
        .set('Authorization', f.bearer(intruder.token))
        .expect(403);
      expect(res.body.code).toBe('RATING403_1');
      expect(await f.listRatings(owner.memberId)).toHaveLength(1);
    });
  });

  describe('실패 응답 틀과 5주차 조회 API 호환', () => {
    it('조회 API 의 성공 본문은 5주차 그대로(감싸지 않고, 토큰도 필요 없다)', async () => {
      const nick = await request(f.server())
        .get(`/members/nickname/${encodeURIComponent('수현')}`)
        .expect(200);
      expect(nick.body).toEqual({ available: false });
      const list = await request(f.server())
        .get('/members/1/ratings')
        .expect(200);
      expect(Array.isArray(list.body)).toBe(true);
    });

    it('조회 API 의 실패는 같은 틀로 바뀌지만 상태 코드는 그대로', async () => {
      const missing = await request(f.server())
        .get('/members/999999/ratings')
        .expect(404);
      expect(missing.body).toEqual(
        f.failure('MEMBER404_1', '해당 회원을 찾을 수 없습니다.'),
      );
      const badNickname = await request(f.server())
        .get('/members/nickname/a')
        .expect(400);
      expect(badNickname.body).toEqual(
        f.failure('COMMON400', '닉네임은 2~12자로 입력해 주세요.'),
      );
      await request(f.server()).get('/members/abc/ratings').expect(400);
    });

    it('없는 경로도 같은 틀의 404', async () => {
      const res = await request(f.server()).get('/nope').expect(404);
      expect(res.body).toEqual(f.failure('COMMON404'));
    });

    it('CORS: 허용 출처에서 Authorization 헤더를 단 POST·PATCH·DELETE 사전 요청(preflight)을 허용한다', async () => {
      const cases: Array<[string, string]> = [
        ['POST', '/ratings'],
        ['PATCH', '/ratings/1'],
        ['DELETE', '/ratings/1'],
        ['PATCH', '/members/me'],
        ['GET', '/members/me'],
        ['POST', '/auth/login'],
      ];
      for (const [method, path] of cases) {
        const res = await request(f.server())
          .options(path)
          .set('Origin', ALLOWED_ORIGIN)
          .set('Access-Control-Request-Method', method)
          .set('Access-Control-Request-Headers', 'authorization,content-type');
        expect(res.status, `${method} ${path}`).toBe(204);
        expect(res.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
        expect(res.headers['access-control-allow-methods']).toContain(method);
        expect(res.headers['access-control-allow-headers']).toContain(
          'authorization',
        );
      }
    });

    it('CORS: 허용하지 않은 출처에는 허용 헤더를 주지 않는다', async () => {
      const res = await request(f.server())
        .options('/ratings')
        .set('Origin', 'http://evil.example')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'authorization');
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
