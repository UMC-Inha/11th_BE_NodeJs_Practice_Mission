import { Repository } from 'typeorm';
import { Favorite } from '../entity/favorite.entity.js';
import { Member } from '../entity/member.entity.js';
import { ApiException, ErrorCode } from '../exception/api.exception.js';
import { FavoriteService } from './favorite.service.js';

const createdAt = new Date('2026-11-18T05:00:00Z');

function member(memberId: number): Member {
  return {
    memberId,
    email: 'noco@umc.com',
    password: '$2a$10$dummyEncodedPasswordValue',
    nickname: '수현',
    createdAt,
    updatedAt: createdAt,
  };
}

function favorite(id: number, movieId: number, ownerId = 1): Favorite {
  return {
    favoriteId: id,
    movieId,
    member: member(ownerId),
    createdAt,
    updatedAt: createdAt,
  };
}

async function expectApiError(
  promise: Promise<unknown>,
  status: number,
  code: string,
) {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ApiException);
  expect((error as ApiException).getStatus()).toBe(status);
  expect((error as ApiException).code).toBe(code);
}

describe('FavoriteService', () => {
  function setup({
    memberExists = true,
    existing = false,
    found = null as Favorite | null,
    list = [] as Favorite[],
  } = {}) {
    const memberRepository = {
      findOneBy: vi.fn().mockResolvedValue(memberExists ? member(1) : null),
    };
    const favoriteRepository = {
      exists: vi.fn().mockResolvedValue(existing),
      findOne: vi.fn().mockResolvedValue(found),
      find: vi.fn().mockResolvedValue(list),
      create: vi.fn((value: Partial<Favorite>) => value),
      save: vi.fn((value: Partial<Favorite>) =>
        Promise.resolve({
          ...value,
          favoriteId: 5,
          createdAt,
          updatedAt: createdAt,
        }),
      ),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    const service = new FavoriteService(
      favoriteRepository as unknown as Repository<Favorite>,
      memberRepository as unknown as Repository<Member>,
    );
    return { service, favoriteRepository, memberRepository };
  }

  describe('create', () => {
    it('토큰의 회원으로 저장하고 favoriteId·movieId·createdAt 세 필드만 돌려준다', async () => {
      const { service, favoriteRepository } = setup();
      const result = await service.create(1, { movieId: 550 });

      expect(favoriteRepository.save).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ favoriteId: 5, movieId: 550, createdAt });
      expect(result).not.toHaveProperty('member');
    });

    it('이미 즐겨찾기했으면 409 FAVORITE409_1 이고 저장하지 않는다', async () => {
      const { service, favoriteRepository } = setup({ existing: true });
      await expectApiError(
        service.create(1, { movieId: 550 }),
        409,
        ErrorCode.FAVORITE_DUPLICATED,
      );
      expect(favoriteRepository.save).not.toHaveBeenCalled();
    });

    it('회원이 없으면 404 MEMBER404_1 이고 중복 검사도 하지 않는다', async () => {
      const { service, favoriteRepository } = setup({ memberExists: false });
      await expectApiError(
        service.create(999, { movieId: 550 }),
        404,
        ErrorCode.MEMBER_NOT_FOUND,
      );
      expect(favoriteRepository.exists).not.toHaveBeenCalled();
    });

    it('사전 검사가 "없다"고 해도 DB UNIQUE 위반은 그대로 위로 던진다(필터가 409 로 바꾼다)', async () => {
      const { service, favoriteRepository } = setup();
      const dup = new Error('Duplicate entry');
      favoriteRepository.save.mockRejectedValue(dup);
      await expect(service.create(1, { movieId: 550 })).rejects.toBe(dup);
    });
  });

  describe('getMyFavorites', () => {
    it('내 것만, favoriteId 내림차순(최신순)으로 조회한다', async () => {
      const { service, favoriteRepository } = setup({
        list: [favorite(3, 300), favorite(1, 100)],
      });
      const result = await service.getMyFavorites(1);

      expect(favoriteRepository.find).toHaveBeenCalledWith({
        where: { member: { memberId: 1 } },
        order: { favoriteId: 'DESC' },
      });
      expect(result.map((x) => x.movieId)).toEqual([300, 100]);
      expect(result[0]).not.toHaveProperty('member');
    });

    it('없으면 오류가 아니라 빈 배열', async () => {
      const { service } = setup();
      await expect(service.getMyFavorites(1)).resolves.toEqual([]);
    });
  });

  describe('getStatus', () => {
    it.each([true, false])(
      'exists 가 %s 면 isFavorite 도 %s',
      async (exists) => {
        const { service, favoriteRepository } = setup({ existing: exists });
        await expect(service.getStatus(1, 550)).resolves.toEqual({
          isFavorite: exists,
        });
        expect(favoriteRepository.exists).toHaveBeenCalledWith({
          where: { member: { memberId: 1 }, movieId: 550 },
        });
      },
    );
  });

  describe('delete', () => {
    it('내 즐겨찾기를 찾아 지운다', async () => {
      const found = favorite(2, 550);
      const { service, favoriteRepository } = setup({ found });
      await service.delete(1, 550);
      expect(favoriteRepository.findOne).toHaveBeenCalledWith({
        where: { member: { memberId: 1 }, movieId: 550 },
      });
      expect(favoriteRepository.remove).toHaveBeenCalledWith(found);
    });

    it('없으면 404 FAVORITE404_1 (인증 실패 401 과 다르다)', async () => {
      const { service, favoriteRepository } = setup({ found: null });
      await expectApiError(
        service.delete(1, 550),
        404,
        ErrorCode.FAVORITE_NOT_FOUND,
      );
      expect(favoriteRepository.remove).not.toHaveBeenCalled();
    });
  });
});
