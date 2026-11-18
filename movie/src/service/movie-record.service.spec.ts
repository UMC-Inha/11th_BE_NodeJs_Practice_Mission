import { DataSource, EntityManager } from 'typeorm';
import { Favorite } from '../entity/favorite.entity.js';
import { Member } from '../entity/member.entity.js';
import { Rating } from '../entity/rating.entity.js';
import { ApiException, ErrorCode } from '../exception/api.exception.js';
import { MovieRecordService } from './movie-record.service.js';

const createdAt = new Date('2026-11-18T05:00:00Z');
const dto = (addToFavorites: boolean) => ({
  movieId: 238,
  score: 5,
  comment: '좋다',
  addToFavorites,
});

/**
 * DataSource.transaction 이 콜백에 manager 를 넘겨 주는 모양을 흉내 낸다.
 * 콜백이 예외를 던지면 rollback, 정상으로 끝나면 commit 이 불렸다고 기록한다.
 */
function setup({
  memberExists = true,
  ratingExists = false,
  favoriteExists = false,
  favoriteSaveError = undefined as Error | undefined,
} = {}) {
  const events: string[] = [];
  const repos = {
    member: {
      findOneBy: vi
        .fn()
        .mockResolvedValue(memberExists ? ({ memberId: 1 } as Member) : null),
    },
    rating: {
      exists: vi.fn().mockResolvedValue(ratingExists),
      create: vi.fn((v: object) => v),
      save: vi.fn((v: object) => {
        events.push('rating.save');
        return Promise.resolve({
          ...v,
          ratingId: 3,
          createdAt,
          updatedAt: createdAt,
        });
      }),
    },
    favorite: {
      exists: vi.fn().mockResolvedValue(favoriteExists),
      create: vi.fn((v: object) => v),
      save: vi.fn((v: object) => {
        events.push('favorite.save');
        return favoriteSaveError
          ? Promise.reject(favoriteSaveError)
          : Promise.resolve({
              ...v,
              favoriteId: 2,
              createdAt,
              updatedAt: createdAt,
            });
      }),
    },
  };
  const manager = {
    getRepository: vi.fn((entity: unknown) =>
      entity === Member
        ? repos.member
        : entity === Rating
          ? repos.rating
          : entity === Favorite
            ? repos.favorite
            : undefined,
    ),
  };
  const transaction = vi.fn(
    async (callback: (m: EntityManager) => Promise<unknown>) => {
      events.push('begin');
      try {
        const result = await callback(manager as unknown as EntityManager);
        events.push('commit');
        return result;
      } catch (error) {
        events.push('rollback');
        throw error;
      }
    },
  );
  const service = new MovieRecordService({
    transaction,
  } as unknown as DataSource);
  return { service, repos, manager, transaction, events };
}

async function codeOf(promise: Promise<unknown>) {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ApiException);
  return (error as ApiException).code;
}

describe('MovieRecordService', () => {
  it('addToFavorites true: 하나의 트랜잭션 안에서 평점 → 즐겨찾기 순서로 저장하고 commit 한다', async () => {
    const { service, transaction, events } = setup();
    const result = await service.create(1, dto(true));

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(events).toEqual(['begin', 'rating.save', 'favorite.save', 'commit']);
    expect(result.rating).toMatchObject({
      ratingId: 3,
      movieId: 238,
      score: 5,
      comment: '좋다',
    });
    expect(result.favorite).toEqual({ favoriteId: 2, movieId: 238, createdAt });
  });

  it('addToFavorites false: 평점만 저장하고 favorite 은 null', async () => {
    const { service, repos, events } = setup();
    const result = await service.create(1, dto(false));

    expect(result.favorite).toBeNull();
    expect(repos.favorite.exists).not.toHaveBeenCalled();
    expect(repos.favorite.save).not.toHaveBeenCalled();
    expect(events).toEqual(['begin', 'rating.save', 'commit']);
  });

  it('콜백 안의 모든 Repository 를 manager 에서 꺼낸다(Service 는 DataSource 만 받는다)', async () => {
    const { service, manager } = setup();
    await service.create(1, dto(true));
    expect(manager.getRepository.mock.calls.map(([e]) => e)).toEqual([
      Member,
      Rating,
      Favorite,
    ]);
    // 생성자가 받는 것은 DataSource 하나뿐 — 주입된 Repository 를 섞어 쓸 수 없는 구조다.
    expect(MovieRecordService.length).toBe(1);
  });

  it('즐겨찾기 저장이 실패하면 오류를 그대로 던지고 rollback 이 일어난다(commit 없음)', async () => {
    const boom = new Error('favorite insert failed');
    const { service, events } = setup({ favoriteSaveError: boom });

    await expect(service.create(1, dto(true))).rejects.toBe(boom);
    expect(events).toEqual([
      'begin',
      'rating.save',
      'favorite.save',
      'rollback',
    ]);
    expect(events).not.toContain('commit');
  });

  it('이미 평점이 있으면 409 RATING409_1 — 아무것도 저장하지 않고 rollback', async () => {
    const { service, repos, events } = setup({ ratingExists: true });
    expect(await codeOf(service.create(1, dto(true)))).toBe(
      ErrorCode.RATING_DUPLICATED,
    );
    expect(repos.rating.save).not.toHaveBeenCalled();
    expect(repos.favorite.save).not.toHaveBeenCalled();
    expect(events).toEqual(['begin', 'rollback']);
  });

  it('즐겨찾기가 이미 있고 addToFavorites true 면 409 FAVORITE409_1 — 평점도 저장하지 않는다', async () => {
    const { service, repos } = setup({ favoriteExists: true });
    expect(await codeOf(service.create(1, dto(true)))).toBe(
      ErrorCode.FAVORITE_DUPLICATED,
    );
    expect(repos.rating.save).not.toHaveBeenCalled();
  });

  it('즐겨찾기가 이미 있어도 addToFavorites false 면 상관없이 평점만 저장한다', async () => {
    const { service, repos } = setup({ favoriteExists: true });
    await service.create(1, dto(false));
    expect(repos.rating.save).toHaveBeenCalledTimes(1);
  });

  it('회원이 없으면 404 MEMBER404_1', async () => {
    const { service } = setup({ memberExists: false });
    expect(await codeOf(service.create(999, dto(true)))).toBe(
      ErrorCode.MEMBER_NOT_FOUND,
    );
  });

  it('후기를 생략하면 null 로 저장한다', async () => {
    const { service, repos } = setup();
    await service.create(1, { movieId: 1, score: 3, addToFavorites: false });
    expect(repos.rating.create).toHaveBeenCalledWith(
      expect.objectContaining({ comment: null }),
    );
  });
});
