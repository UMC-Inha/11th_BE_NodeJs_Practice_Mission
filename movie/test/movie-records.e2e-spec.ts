import { Logger } from '@nestjs/common';
import request from 'supertest';
import { FavoriteService } from '../src/service/favorite.service.js';
import { RatingService } from '../src/service/rating.service.js';
import { Fixture, TestUser, createFixture } from './support/app-fixture.js';

/**
 * 8주차 POST /movie-records: 평점과 즐겨찾기를 "한 트랜잭션" 으로 저장하는지 실제 MySQL 에서 증명한다.
 * 일회용 DB 에서만 돈다. 롤백 증명은 DB 트리거로 "첫 저장은 성공하고 둘째 저장만 실패하는" 상황을 만든다.
 */
describe('영화 기록 API 와 트랜잭션 (격리된 테스트 DB)', () => {
  let f: Fixture;

  beforeAll(async () => {
    f = await createFixture('umc_movie_test_rec');
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

  const record = (user: TestUser, body: object) =>
    f.as(user).post('/movie-records', body);

  /** 이 회원이 이 영화에 남긴 평점·즐겨찾기 행 수 */
  const rows = async (user: TestUser, movieId: number) => ({
    rating: await f.ratings.countBy({
      member: { memberId: user.memberId },
      movieId,
    }),
    favorite: await f.favorites.countBy({
      member: { memberId: user.memberId },
      movieId,
    }),
  });

  describe('성공', () => {
    it('addToFavorites true: 201, result.rating 과 result.favorite 이 함께 있고 DB 에 각각 1행', async () => {
      const me = await f.signUpAndLogin();
      const res = await record(me, {
        movieId: 238,
        score: 5,
        comment: '다시 보고 싶은 영화입니다.',
        addToFavorites: true,
      }).expect(201);

      expect(res.body).toEqual({
        isSuccess: true,
        code: 'COMMON201',
        message: '영화 기록을 저장했습니다.',
        result: {
          rating: {
            ratingId: expect.any(Number),
            movieId: 238,
            score: 5,
            comment: '다시 보고 싶은 영화입니다.',
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
          },
          favorite: {
            favoriteId: expect.any(Number),
            movieId: 238,
            createdAt: expect.any(String),
          },
        },
      });
      expect(await rows(me, 238)).toEqual({ rating: 1, favorite: 1 });
      // 같은 데이터가 각각의 조회 API 에서도 보인다
      expect(
        (await f.as(me).get('/favorites/238').expect(200)).body.result
          .isFavorite,
      ).toBe(true);
      expect((await f.listRatings(me.memberId)).map((r) => r.movieId)).toEqual([
        238,
      ]);
    });

    it('addToFavorites false: 평점만 저장하고 favorite 은 null, 즐겨찾기 행은 만들지 않는다', async () => {
      const me = await f.signUpAndLogin();
      const res = await record(me, {
        movieId: 155,
        score: 4,
        addToFavorites: false,
      }).expect(201);

      expect(res.body.result.favorite).toBeNull();
      expect(res.body.result.rating).toMatchObject({
        movieId: 155,
        score: 4,
        comment: null,
      });
      expect(await rows(me, 155)).toEqual({ rating: 1, favorite: 0 });
    });

    it('이미 즐겨찾기한 영화라도 addToFavorites false 면 평점만 저장된다', async () => {
      const me = await f.signUpAndLogin();
      await f.addFavorite(me, 680);
      await record(me, {
        movieId: 680,
        score: 3,
        addToFavorites: false,
      }).expect(201);
      expect(await rows(me, 680)).toEqual({ rating: 1, favorite: 1 });
    });
  });

  describe('실패하면 아무것도 저장되지 않는다 (행 수가 그대로)', () => {
    it('같은 요청을 다시 보내면 409 RATING409_1 이고 평점·즐겨찾기 행이 늘지 않는다', async () => {
      const me = await f.signUpAndLogin();
      const body = {
        movieId: 238,
        score: 5,
        comment: '처음',
        addToFavorites: true,
      };
      await record(me, body).expect(201);
      expect(await rows(me, 238)).toEqual({ rating: 1, favorite: 1 });

      const again = await record(me, { ...body, comment: '두 번째' }).expect(
        409,
      );
      expect(again.body).toEqual(
        f.failure('RATING409_1', '이미 이 영화에 평점을 남기셨습니다.'),
      );
      expect(await rows(me, 238)).toEqual({ rating: 1, favorite: 1 });
      // 처음 저장한 평점이 두 번째 요청으로 덮이지도 않았다
      expect((await f.listRatings(me.memberId))[0].comment).toBe('처음');
    });

    it('평점만 있던 영화에 addToFavorites false 로 다시 보내도 409 RATING409_1', async () => {
      const me = await f.signUpAndLogin();
      await f.addRating(me, 11);
      const res = await record(me, {
        movieId: 11,
        score: 5,
        addToFavorites: false,
      }).expect(409);
      expect(res.body.code).toBe('RATING409_1');
      expect(await rows(me, 11)).toEqual({ rating: 1, favorite: 0 });
    });

    // 9주차 선택 미션의 시나리오 그대로다. 다만 이 서비스는 평점을 저장하기 "전에" 즐겨찾기 중복을 먼저 검사해서,
    // 트랜잭션을 지워도 이 테스트는 통과한다(평점을 저장하기 전에 이미 409 로 끝나기 때문).
    // 트랜잭션이 정말 되돌리는지는 아래 '롤백 증명' 의 두 테스트(트리거로 실패 만들기 · 경쟁 재현)가 확인한다.
    it('즐겨찾기가 이미 있고 addToFavorites true 면 409 FAVORITE409_1 이고 평점도 저장되지 않는다 (사전 검사가 먼저 막으므로 트랜잭션이 없어도 통과한다)', async () => {
      const me = await f.signUpAndLogin();
      await f.addFavorite(me, 13);

      const res = await record(me, {
        movieId: 13,
        score: 4,
        addToFavorites: true,
      }).expect(409);
      expect(res.body).toEqual(
        f.failure('FAVORITE409_1', '이미 이 영화를 즐겨찾기하셨습니다.'),
      );
      expect(await rows(me, 13)).toEqual({ rating: 0, favorite: 1 });
    });

    it('입력 규칙을 통과하지 못하면 400 이고 아무것도 저장하지 않는다', async () => {
      const me = await f.signUpAndLogin();
      const ok = { movieId: 77, score: 4, addToFavorites: true };
      const cases: Array<[string, object, string]> = [
        ['별점 0', { ...ok, score: 0 }, '별점은 1점 이상이어야 합니다.'],
        ['별점 6', { ...ok, score: 6 }, '별점은 5점 이하여야 합니다.'],
        ['별점 소수', { ...ok, score: 4.5 }, '별점은 정수여야 합니다.'],
        [
          '별점 생략',
          { movieId: 77, addToFavorites: true },
          '별점은 필수입니다.',
        ],
        ['영화 ID 0', { ...ok, movieId: 0 }, '영화 ID는 양수여야 합니다.'],
        [
          '영화 ID 생략',
          { score: 4, addToFavorites: true },
          '영화 ID는 필수입니다.',
        ],
        [
          'addToFavorites 생략',
          { movieId: 77, score: 4 },
          '즐겨찾기 추가 여부는 true 또는 false여야 합니다.',
        ],
        [
          'addToFavorites 문자열',
          { ...ok, addToFavorites: 'true' },
          '즐겨찾기 추가 여부는 true 또는 false여야 합니다.',
        ],
        [
          '후기 501자',
          { ...ok, comment: 'ㅋ'.repeat(501) },
          '후기는 500자 이하로 입력해주세요.',
        ],
        [
          'memberId 를 몰래',
          { ...ok, memberId: 1 },
          'property memberId should not exist',
        ],
      ];
      for (const [label, body, message] of cases) {
        const res = await record(me, body).expect(400);
        expect(res.body, label).toEqual(f.failure('COMMON400', message));
      }
      expect(await rows(me, 77)).toEqual({ rating: 0, favorite: 0 });
    });

    it('토큰 없이는 401 AUTH401_2, 회원이 사라졌으면 404 MEMBER404_1', async () => {
      const res = await request(f.server())
        .post('/movie-records')
        .send({ movieId: 1, score: 3, addToFavorites: true })
        .expect(401);
      expect(res.body.code).toBe('AUTH401_2');

      const ghost = await f.signUpAndLogin();
      await f.members.delete({ memberId: ghost.memberId });
      const gone = await record(ghost, {
        movieId: 1,
        score: 3,
        addToFavorites: true,
      }).expect(404);
      expect(gone.body.code).toBe('MEMBER404_1');
    });
  });

  describe('롤백 증명 — 둘째 저장이 실패하면 첫째 저장도 취소된다 (실제 DB)', () => {
    /** 트리거를 만들고, 테스트가 끝나면 반드시 지운다. */
    async function withTrigger<T>(
      name: string,
      ddl: string,
      body: () => Promise<T>,
    ): Promise<T> {
      await f.dataSource.query(`DROP TRIGGER IF EXISTS ${name}`);
      await f.dataSource.query(ddl);
      try {
        return await body();
      } finally {
        await f.dataSource.query(`DROP TRIGGER IF EXISTS ${name}`);
      }
    }

    // favorite INSERT 만 실패하게 만든다(사전 조회 SELECT 는 정상). 평점 INSERT 는 이미 성공한 뒤다.
    const FAIL_FAVORITE_INSERT = `CREATE TRIGGER block_favorite_insert BEFORE INSERT ON favorite
      FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '강제로 만든 즐겨찾기 저장 실패'`;

    it('트랜잭션: 즐겨찾기 INSERT 가 실패하면 먼저 저장한 평점도 되돌려져 두 테이블 모두 0행이다', async () => {
      const me = await f.signUpAndLogin();
      // 이미 beforeEach 에서 가려 둔 Logger.error 의 호출 기록을 본다.
      const errorLog = vi.spyOn(Logger.prototype, 'error');

      const res = await withTrigger(
        'block_favorite_insert',
        FAIL_FAVORITE_INSERT,
        () => record(me, { movieId: 9001, score: 5, addToFavorites: true }),
      );

      // 원문은 서버 로그에만 남고(필터가 error 로 한 번 기록), 응답은 내부 메시지를 숨긴 500
      expect(errorLog).toHaveBeenCalledTimes(1);
      expect(res.status).toBe(500);
      expect(res.body).toEqual(
        f.failure(
          'COMMON500',
          '서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
        ),
      );
      expect(res.text).not.toContain('강제로 만든');
      // 평점 INSERT 가 성공한 뒤에 실패했는데도, 평점이 남아 있지 않다 = rollback
      expect(await rows(me, 9001)).toEqual({ rating: 0, favorite: 0 });
    });

    it('트랜잭션 없이 두 Service 를 연달아 부르면(워크북이 경고한 방식) 평점만 남는다', async () => {
      const me = await f.signUpAndLogin();
      const ratingService = f.app.get(RatingService);
      const favoriteService = f.app.get(FavoriteService);

      const outcome = await withTrigger(
        'block_favorite_insert',
        FAIL_FAVORITE_INSERT,
        async () => {
          // 각 Service 가 따로 저장(따로 commit)한다.
          await ratingService.create(me.memberId, { movieId: 9002, score: 5 });
          return favoriteService.create(me.memberId, { movieId: 9002 }).then(
            () => 'ok',
            () => 'favorite-failed',
          );
        },
      );

      expect(outcome).toBe('favorite-failed');
      // 평점은 저장된 채로 남았고 즐겨찾기는 없다 — 사용자가 의도한 "둘 다"와 다른 어중간한 상태
      expect(await rows(me, 9002)).toEqual({ rating: 1, favorite: 0 });
    });

    it('경쟁 상황 재현: 평점 저장 직후 다른 요청이 같은 즐겨찾기를 넣으면 UNIQUE 위반 → FAVORITE409_1, 평점·즐겨찾기 모두 취소', async () => {
      const me = await f.signUpAndLogin();
      // 평점이 저장되는 순간 같은 (member, movie) 즐겨찾기가 "다른 요청에 의해" 들어간 것처럼 만든다.
      // 서비스의 사전 검사(exists)는 이미 통과한 뒤라, 둘째 저장이 진짜 UNIQUE 제약에 걸린다.
      const res = await withTrigger(
        'race_favorite_after_rating',
        `CREATE TRIGGER race_favorite_after_rating AFTER INSERT ON rating
         FOR EACH ROW INSERT INTO favorite (member_id, movie_id) VALUES (NEW.member_id, NEW.movie_id)`,
        () => record(me, { movieId: 9003, score: 4, addToFavorites: true }),
      );

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('FAVORITE409_1');
      // 트리거가 넣은 즐겨찾기까지 포함해 트랜잭션 전체가 취소됐다
      expect(await rows(me, 9003)).toEqual({ rating: 0, favorite: 0 });
    });

    it('addToFavorites false 면 즐겨찾기 INSERT 를 하지 않으므로 같은 트리거가 있어도 평점은 저장된다', async () => {
      const me = await f.signUpAndLogin();
      const res = await withTrigger(
        'block_favorite_insert',
        FAIL_FAVORITE_INSERT,
        () => record(me, { movieId: 9004, score: 3, addToFavorites: false }),
      );
      expect(res.status).toBe(201);
      expect(await rows(me, 9004)).toEqual({ rating: 1, favorite: 0 });
    });
  });

  describe('동시 요청', () => {
    it('같은 영화로 8번 동시에 기록해도 평점 1행·즐겨찾기 1행만 남고 서로 어긋나지 않는다', async () => {
      const me = await f.signUpAndLogin();
      const results = await Promise.all(
        Array.from({ length: 8 }, () =>
          record(me, { movieId: 9100, score: 5, addToFavorites: true }),
        ),
      );

      expect(results.filter((r) => r.status === 201)).toHaveLength(1);
      for (const res of results.filter((r) => r.status !== 201)) {
        expect(res.status).toBe(409);
        expect(['RATING409_1', 'FAVORITE409_1']).toContain(res.body.code);
      }
      // 평점과 즐겨찾기가 항상 짝으로 저장된다
      expect(await rows(me, 9100)).toEqual({ rating: 1, favorite: 1 });
    });
  });
});
