import { Logger } from '@nestjs/common';
import request from 'supertest';
import { Fixture, createFixture } from './support/app-fixture.js';

/**
 * 8주차 즐겨찾기 API 를 실제 MySQL 에서 검증한다. 개발용 umc_movie 가 아니라 일회용 DB 에서만 돈다.
 * 워크북 "Postman 으로 확인하기" 시나리오와 "실습 4 실패 상황" 표를 그대로 따라간다.
 * 어느 API 도 memberId 를 받지 않는다 — 누구의 즐겨찾기인지는 토큰이 알려 준다.
 */
describe('즐겨찾기 API (격리된 테스트 DB)', () => {
  let f: Fixture;

  beforeAll(async () => {
    f = await createFixture('umc_movie_test_fav');
  });

  afterAll(async () => {
    await f.close();
  });

  // 서버 로그(DB UNIQUE 변환 경고, 500 스택)는 남기되 테스트 출력은 조용히 둔다.
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('워크북 Postman 시나리오 (한 회원, 영화 550)', () => {
    it('등록 201 → 중복 409 → 목록 1건 → 여부 true → 해제 200 → 여부 false → 목록 []', async () => {
      const me = await f.signUpAndLogin();

      // 1) POST /favorites → 201
      const created = await f
        .as(me)
        .post('/favorites', { movieId: 550 })
        .expect(201);
      expect(created.body).toEqual({
        isSuccess: true,
        code: 'COMMON201',
        message: '즐겨찾기를 등록했습니다.',
        result: {
          favoriteId: expect.any(Number),
          movieId: 550,
          createdAt: expect.any(String),
        },
      });
      // Entity 를 그대로 내보내지 않는다: member·password 가 응답에 없다.
      expect(created.text).not.toContain('password');
      expect(created.text).not.toContain('member');

      // 2) 같은 요청을 한 번 더 → 409 FAVORITE409_1
      const duplicated = await f
        .as(me)
        .post('/favorites', { movieId: 550 })
        .expect(409);
      expect(duplicated.body).toEqual(
        f.failure('FAVORITE409_1', '이미 이 영화를 즐겨찾기하셨습니다.'),
      );

      // 3) GET /favorites → 방금 저장한 영화가 한 개
      const list = await f.as(me).get('/favorites').expect(200);
      expect(list.body).toEqual({
        isSuccess: true,
        code: 'COMMON200',
        message: '내 즐겨찾기 목록을 조회했습니다.',
        result: [created.body.result],
      });

      // 4) GET /favorites/550 → isFavorite: true
      const on = await f.as(me).get('/favorites/550').expect(200);
      expect(on.body).toEqual({
        isSuccess: true,
        code: 'COMMON200',
        message: '즐겨찾기 여부를 조회했습니다.',
        result: { isFavorite: true },
      });

      // 5) DELETE /favorites/550 → 200, COMMON200, result: null
      const removed = await f.as(me).delete('/favorites/550').expect(200);
      expect(removed.body).toEqual({
        isSuccess: true,
        code: 'COMMON200',
        message: '즐겨찾기를 해제했습니다.',
        result: null,
      });

      // 6) 다시 여부 조회 → isFavorite: false (오류가 아니라 정상 상태)
      const off = await f.as(me).get('/favorites/550').expect(200);
      expect(off.body.result).toEqual({ isFavorite: false });

      // 7) 목록 → 빈 배열 (오류가 아니다)
      const empty = await f.as(me).get('/favorites').expect(200);
      expect(empty.body.result).toEqual([]);
    });
  });

  describe('실습 4: 실패 상황', () => {
    it('토큰 없이 네 API 를 부르면 모두 401 AUTH401_2', async () => {
      // supertest 요청은 하나씩 만들고 끝낸다(서버를 임시 포트에 붙였다 떼기 때문에 한꺼번에 만들면 겹친다).
      const calls = [
        () => request(f.server()).post('/favorites').send({ movieId: 550 }),
        () => request(f.server()).get('/favorites'),
        () => request(f.server()).get('/favorites/550'),
        () => request(f.server()).delete('/favorites/550'),
      ];
      for (const call of calls) {
        const res = await call().expect(401);
        expect(res.body).toEqual(
          f.failure('AUTH401_2', '로그인이 필요한 요청입니다.'),
        );
      }
    });

    it('위조·형식이 틀린 토큰은 401 AUTH401_3', async () => {
      const res = await request(f.server())
        .get('/favorites')
        .set('Authorization', 'Bearer not.a.token')
        .expect(401);
      expect(res.body.code).toBe('AUTH401_3');
    });

    it('즐겨찾기하지 않은 영화의 여부 조회는 200, isFavorite: false', async () => {
      const me = await f.signUpAndLogin();
      const res = await f.as(me).get('/favorites/999999').expect(200);
      expect(res.body.result).toEqual({ isFavorite: false });
    });

    it('없던 관계는 해제할 수 없다: 404 FAVORITE404_1 (401 과 다르다)', async () => {
      const me = await f.signUpAndLogin();
      const res = await f.as(me).delete('/favorites/777').expect(404);
      expect(res.body).toEqual(
        f.failure('FAVORITE404_1', '즐겨찾기한 영화를 찾을 수 없습니다.'),
      );
      // 한 번 해제한 것을 또 해제해도 404
      await f.addFavorite(me, 777);
      await f.as(me).delete('/favorites/777').expect(200);
      await f.as(me).delete('/favorites/777').expect(404);
    });

    it('movieId 규칙을 통과하지 못하면 400 이고 아무것도 저장하지 않는다', async () => {
      const me = await f.signUpAndLogin();
      const before = await f.favorites.count();
      const cases: Array<[string, object, string]> = [
        ['0', { movieId: 0 }, '영화 ID는 양수여야 합니다.'],
        ['음수', { movieId: -5 }, '영화 ID는 양수여야 합니다.'],
        ['소수', { movieId: 1.5 }, '영화 ID는 정수여야 합니다.'],
        ['문자열', { movieId: '550' }, '영화 ID는 정수여야 합니다.'],
        ['생략', {}, '영화 ID는 필수입니다.'],
        ['null', { movieId: null }, '영화 ID는 필수입니다.'],
      ];
      for (const [label, body, message] of cases) {
        const res = await f.as(me).post('/favorites', body).expect(400);
        expect(res.body, label).toEqual(f.failure('COMMON400', message));
      }
      expect(await f.favorites.count()).toBe(before);
    });

    it('Body 에 memberId 를 몰래 넣어도 400 으로 거절된다 (누구의 것인지는 토큰만 정한다)', async () => {
      const me = await f.signUpAndLogin();
      const other = await f.signUpAndLogin();
      const res = await f
        .as(me)
        .post('/favorites', { movieId: 31, memberId: other.memberId })
        .expect(400);
      expect(res.body.message).toBe('property memberId should not exist');
      expect(await f.favorites.countBy({ movieId: 31 })).toBe(0);
    });

    it('경로의 movieId 가 숫자가 아니면 400', async () => {
      const me = await f.signUpAndLogin();
      expect((await f.as(me).get('/favorites/abc').expect(400)).body.code).toBe(
        'COMMON400',
      );
      expect(
        (await f.as(me).delete('/favorites/abc').expect(400)).body.code,
      ).toBe('COMMON400');
    });

    it('토큰은 유효한데 회원이 사라졌다면 404 MEMBER404_1', async () => {
      const ghost = await f.signUpAndLogin();
      await f.members.delete({ memberId: ghost.memberId });
      const res = await f
        .as(ghost)
        .post('/favorites', { movieId: 12 })
        .expect(404);
      expect(res.body.code).toBe('MEMBER404_1');
    });
  });

  describe('내 즐겨찾기만 다룬다', () => {
    it('두 회원의 목록·여부·해제가 서로 섞이지 않고, 최근 등록한 순서(favoriteId 내림차순)다', async () => {
      const a = await f.signUpAndLogin();
      const b = await f.signUpAndLogin();
      await f.addFavorite(a, 100);
      await f.addFavorite(a, 200);
      await f.addFavorite(a, 300);
      await f.addFavorite(b, 200); // 같은 영화를 다른 회원도 즐겨찾기할 수 있다

      const listA = await f.as(a).get('/favorites').expect(200);
      expect(
        listA.body.result.map((x: { movieId: number }) => x.movieId),
      ).toEqual([300, 200, 100]);
      const ids = listA.body.result.map(
        (x: { favoriteId: number }) => x.favoriteId,
      );
      expect(ids).toEqual([...ids].sort((x: number, y: number) => y - x));

      const listB = await f.as(b).get('/favorites').expect(200);
      expect(
        listB.body.result.map((x: { movieId: number }) => x.movieId),
      ).toEqual([200]);

      // B 는 A 만 즐겨찾기한 영화를 즐겨찾기하지 않은 것으로 보인다
      expect(
        (await f.as(b).get('/favorites/100').expect(200)).body.result,
      ).toEqual({
        isFavorite: false,
      });
      // B 가 A 의 영화를 해제하려 하면 "없음" 이다(남의 것을 건드리지 못한다)
      await f.as(b).delete('/favorites/100').expect(404);
      expect(
        (await f.as(a).get('/favorites/100').expect(200)).body.result
          .isFavorite,
      ).toBe(true);
      // B 가 자기 것을 해제해도 A 의 같은 영화는 그대로다
      await f.as(b).delete('/favorites/200').expect(200);
      expect(
        (await f.as(a).get('/favorites/200').expect(200)).body.result
          .isFavorite,
      ).toBe(true);
    });
  });

  describe('사전 검사를 통과해도 DB UNIQUE 가 막는다', () => {
    it('같은 영화를 동시에 8번 즐겨찾기하면 정확히 1건만 201, 나머지는 409 FAVORITE409_1, DB 에는 1행', async () => {
      const me = await f.signUpAndLogin();
      const results = await Promise.all(
        Array.from({ length: 8 }, () =>
          f.as(me).post('/favorites', { movieId: 4242 }),
        ),
      );

      expect(results.map((r) => r.status).sort((x, y) => x - y)).toEqual([
        201, 409, 409, 409, 409, 409, 409, 409,
      ]);
      for (const res of results.filter((r) => r.status === 409)) {
        expect(res.body).toEqual(f.failure('FAVORITE409_1'));
      }
      expect(
        await f.favorites.countBy({
          member: { memberId: me.memberId },
          movieId: 4242,
        }),
      ).toBe(1);
    });

    it('8개 요청이 사전 검사를 모두 "없음"으로 통과하게 만들어도(배리어) DB UNIQUE 가 7개를 막는다: 1건 201, 7건 409 FAVORITE409_1, 1행', async () => {
      const me = await f.signUpAndLogin();
      const warned = vi.spyOn(Logger.prototype, 'warn');
      // 사전 검사(exists)가 8개 요청 모두 도착할 때까지 기다렸다가 한꺼번에 false 를 답하게 한다.
      // = 8개 요청이 "아직 아무도 저장하지 않았다"고 믿고 동시에 저장 단계로 들어가는 최악의 경쟁.
      let arrived = 0;
      let release!: () => void;
      const everyoneArrived = new Promise<void>(
        (resolve) => (release = resolve),
      );
      vi.spyOn(f.favorites, 'exists').mockImplementation(async () => {
        arrived += 1;
        if (arrived === 8) release();
        await everyoneArrived;
        return false;
      });

      const results = await Promise.all(
        Array.from({ length: 8 }, () =>
          f.as(me).post('/favorites', { movieId: 5151 }),
        ),
      );

      expect(arrived).toBe(8);
      expect(results.map((r) => r.status).sort((x, y) => x - y)).toEqual([
        201, 409, 409, 409, 409, 409, 409, 409,
      ]);
      for (const res of results.filter((r) => r.status === 409)) {
        expect(res.body).toEqual(
          f.failure('FAVORITE409_1', '이미 이 영화를 즐겨찾기하셨습니다.'),
        );
      }
      // 7번 모두 사전 검사가 아니라 DB 제약이 막았다는 증거: 필터가 "UNIQUE 위반을 409 로 바꿨다"고 7번 기록했다.
      expect(warned).toHaveBeenCalledTimes(7);
      expect(String(warned.mock.calls[0][0])).toContain(
        'uk_favorite_member_movie',
      );
      expect(
        await f.favorites.countBy({
          member: { memberId: me.memberId },
          movieId: 5151,
        }),
      ).toBe(1);
    });

    it('사전 검사가 "없다"고 잘못 답해도(경쟁 재현) DB 제약 위반이 FAVORITE409_1 로 바뀐다', async () => {
      const me = await f.signUpAndLogin();
      await f.addFavorite(me, 550);
      vi.spyOn(f.favorites, 'exists').mockResolvedValue(false);

      const res = await f
        .as(me)
        .post('/favorites', { movieId: 550 })
        .expect(409);
      expect(res.body).toEqual(
        f.failure('FAVORITE409_1', '이미 이 영화를 즐겨찾기하셨습니다.'),
      );
      expect(
        await f.favorites.countBy({ member: { memberId: me.memberId } }),
      ).toBe(1);
    });

    it('서비스를 거치지 않고 DB 에 직접 넣어도 UNIQUE(member_id, movie_id)가 두 번째 행을 거부한다', async () => {
      const me = await f.signUpAndLogin();
      const other = await f.signUpAndLogin();
      const insert = (memberId: number, movieId: number) =>
        f.dataSource.query(
          'INSERT INTO favorite (member_id, movie_id) VALUES (?, ?)',
          [memberId, movieId],
        );

      await insert(me.memberId, 8888);
      const error = await insert(me.memberId, 8888).then(
        () => undefined,
        (e: unknown) => e as { code?: string; sqlMessage?: string },
      );
      expect(error?.code).toBe('ER_DUP_ENTRY');
      expect(error?.sqlMessage).toContain('uk_favorite_member_movie');
      // 같은 영화여도 다른 회원이면 들어간다 — movie_id 만 UNIQUE 가 아니라 "한 쌍"이 UNIQUE 이다.
      await insert(other.memberId, 8888);
      expect(await f.favorites.countBy({ movieId: 8888 })).toBe(2);
    });
  });
});
