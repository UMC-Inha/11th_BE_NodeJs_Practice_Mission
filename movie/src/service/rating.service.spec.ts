import { Repository } from 'typeorm';
import { Member } from '../entity/member.entity.js';
import { Rating } from '../entity/rating.entity.js';
import { ApiException, ErrorCode } from '../exception/api.exception.js';
import { RatingService } from './rating.service.js';

const createdAt = new Date('2026-08-26T01:00:00Z');

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

function rating(id: number, movieId: number, ownerId = 1): Rating {
  return {
    ratingId: id,
    movieId,
    score: 5,
    comment: null,
    createdAt,
    updatedAt: createdAt,
    member: member(ownerId),
  };
}

/** 던져진 오류가 ApiException 이고 status/code 가 기대와 같은지 확인한다. */
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

describe('RatingService', () => {
  function setup(memberExists: boolean, ratings: Rating[] = []) {
    const memberRepository = {
      exists: vi.fn().mockResolvedValue(memberExists),
    };
    const ratingRepository = { find: vi.fn().mockResolvedValue(ratings) };
    const service = new RatingService(
      ratingRepository as unknown as Repository<Rating>,
      memberRepository as unknown as Repository<Member>,
    );
    return { service, ratingRepository };
  }

  it('없는 회원이면 404 MEMBER404_1', async () => {
    const { service, ratingRepository } = setup(false);
    await expectApiError(
      service.getRatingsByMember(999),
      404,
      ErrorCode.MEMBER_NOT_FOUND,
    );
    expect(ratingRepository.find).not.toHaveBeenCalled();
  });

  it('ratingId 최신순으로 조회하고 명세의 6개 필드만 돌려준다', async () => {
    const { service, ratingRepository } = setup(true, [rating(2, 155)]);
    const result = await service.getRatingsByMember(1);

    expect(ratingRepository.find).toHaveBeenCalledWith({
      where: { member: { memberId: 1 } },
      order: { ratingId: 'DESC' },
    });
    expect(Object.keys(result[0])).toEqual([
      'ratingId',
      'movieId',
      'score',
      'comment',
      'createdAt',
      'updatedAt',
    ]);
    expect(JSON.stringify(result)).not.toContain('password');
  });

  it('page·size 를 주면 그만큼 건너뛰고 잘라 온다', async () => {
    const { service, ratingRepository } = setup(true);
    await service.getRatingsByMember(1, { page: 2, size: 5 });
    expect(ratingRepository.find).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 5 }),
    );
  });

  it('size 만 주면 page 0 부터, page 만 주면 size 10', async () => {
    const { service, ratingRepository } = setup(true);
    await service.getRatingsByMember(1, { size: 1 });
    expect(ratingRepository.find).toHaveBeenLastCalledWith(
      expect.objectContaining({ skip: 0, take: 1 }),
    );
    await service.getRatingsByMember(1, { page: 1 });
    expect(ratingRepository.find).toHaveBeenLastCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
  });
});

describe('RatingService 쓰기 (등록·수정·삭제)', () => {
  function setup(options: { member?: Member | null; found?: Rating | null }) {
    const memberRepository = {
      findOneBy: vi.fn().mockResolvedValue(options.member ?? null),
    };
    const ratingRepository = {
      exists: vi.fn().mockResolvedValue(false),
      findOne: vi.fn().mockResolvedValue(options.found ?? null),
      create: vi.fn((data: Partial<Rating>) => data as Rating),
      save: vi.fn((data: Rating) =>
        Promise.resolve(
          Object.assign({ createdAt, updatedAt: createdAt }, data, {
            ratingId: data.ratingId ?? 77,
          }),
        ),
      ),
      remove: vi.fn().mockResolvedValue(undefined),
    };
    const service = new RatingService(
      ratingRepository as unknown as Repository<Rating>,
      memberRepository as unknown as Repository<Member>,
    );
    return { service, ratingRepository };
  }

  describe('create', () => {
    it('저장하고 만들어진 평점을 돌려준다, comment 를 생략하면 null', async () => {
      const { service, ratingRepository } = setup({ member: member(1) });
      await expect(
        service.create(1, { movieId: 550, score: 5 }),
      ).resolves.toEqual({
        ratingId: 77,
        movieId: 550,
        score: 5,
        comment: null,
        createdAt,
        updatedAt: createdAt,
      });
      expect(ratingRepository.create).toHaveBeenCalledWith({
        member: member(1),
        movieId: 550,
        score: 5,
        comment: null,
      });
    });

    it('없는 회원이면 404 이고 저장하지 않는다', async () => {
      const { service, ratingRepository } = setup({ member: null });
      await expectApiError(
        service.create(999, { movieId: 550, score: 5 }),
        404,
        ErrorCode.MEMBER_NOT_FOUND,
      );
      expect(ratingRepository.save).not.toHaveBeenCalled();
    });

    it('같은 회원·같은 영화면 409 RATING409_1 이고 저장하지 않는다', async () => {
      const { service, ratingRepository } = setup({ member: member(1) });
      ratingRepository.exists.mockResolvedValue(true);
      await expectApiError(
        service.create(1, { movieId: 550, score: 5 }),
        409,
        ErrorCode.RATING_DUPLICATED,
      );
      expect(ratingRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('내 평점이면 점수와 후기를 바꾼다', async () => {
      const { service, ratingRepository } = setup({ found: rating(5, 550) });
      const result = await service.update(1, 5, {
        score: 2,
        comment: '다시 보니 별로',
      });
      expect(ratingRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ score: 2, comment: '다시 보니 별로' }),
      );
      // 수정된 평점을 그대로 돌려준다(password 가 섞인 member 는 DTO 에서 빠진다)
      expect(result).toMatchObject({ ratingId: 5, score: 2 });
      expect(JSON.stringify(result)).not.toContain('password');
    });

    it('comment 를 생략하면 기존 후기를 그대로 두고, null 이면 지운다', async () => {
      const kept = Object.assign(rating(5, 550), { comment: '원래 후기' });
      const first = setup({ found: kept });
      await first.service.update(1, 5, { score: 4 });
      expect(first.ratingRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ score: 4, comment: '원래 후기' }),
      );

      const cleared = setup({
        found: Object.assign(rating(5, 550), { comment: '지울 후기' }),
      });
      await cleared.service.update(1, 5, { score: 4, comment: null });
      expect(cleared.ratingRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ comment: null }),
      );
    });

    it('없는 평점이면 404 RATING404_1', async () => {
      const { service } = setup({ found: null });
      await expectApiError(
        service.update(1, 999, { score: 3 }),
        404,
        ErrorCode.RATING_NOT_FOUND,
      );
    });

    it('다른 회원의 평점이면 403 RATING403_1 이고 바꾸지 않는다', async () => {
      const { service, ratingRepository } = setup({
        found: rating(5, 550, 2),
      });
      await expectApiError(
        service.update(1, 5, { score: 1 }),
        403,
        ErrorCode.RATING_FORBIDDEN,
      );
      expect(ratingRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('내 평점이면 지운다', async () => {
      const { service, ratingRepository } = setup({ found: rating(5, 550) });
      await service.delete(1, 5);
      expect(ratingRepository.remove).toHaveBeenCalledTimes(1);
    });

    it('없는 평점이면 404, 다른 회원의 평점이면 403 이고 지우지 않는다', async () => {
      const missing = setup({ found: null });
      await expectApiError(
        missing.service.delete(1, 999),
        404,
        ErrorCode.RATING_NOT_FOUND,
      );

      const others = setup({ found: rating(5, 550, 2) });
      await expectApiError(
        others.service.delete(1, 5),
        403,
        ErrorCode.RATING_FORBIDDEN,
      );
      expect(missing.ratingRepository.remove).not.toHaveBeenCalled();
      expect(others.ratingRepository.remove).not.toHaveBeenCalled();
    });
  });
});

describe('RatingService 소유권 확인 순서 (인가)', () => {
  function setup(found: Rating | null) {
    const ratingRepository = {
      findOne: vi.fn().mockResolvedValue(found),
      save: vi.fn(),
      remove: vi.fn(),
    };
    const service = new RatingService(
      ratingRepository as unknown as Repository<Rating>,
      {} as unknown as Repository<Member>,
    );
    return { service, ratingRepository };
  }

  it('평점을 먼저 찾고(없으면 404) 그다음에 주인을 본다 — 없는 평점에 403 을 주지 않는다', async () => {
    const { service } = setup(null);
    await expectApiError(
      service.update(2, 999, { score: 3 }),
      404,
      ErrorCode.RATING_NOT_FOUND,
    );
    await expectApiError(
      service.delete(2, 999),
      404,
      ErrorCode.RATING_NOT_FOUND,
    );
  });

  it('작성자를 함께 불러와서(relations.member) 토큰의 주인과 비교한다', async () => {
    const { service, ratingRepository } = setup(rating(5, 550, 1));
    await service.delete(1, 5);
    expect(ratingRepository.findOne).toHaveBeenCalledWith({
      where: { ratingId: 5 },
      relations: { member: true },
    });
  });

  it('요청자가 작성자와 다르면 수정·삭제 모두 403 이고 아무것도 바꾸지 않는다', async () => {
    const { service, ratingRepository } = setup(rating(5, 550, 1));
    await expectApiError(
      service.update(2, 5, { score: 1 }),
      403,
      ErrorCode.RATING_FORBIDDEN,
    );
    await expectApiError(service.delete(2, 5), 403, ErrorCode.RATING_FORBIDDEN);
    expect(ratingRepository.save).not.toHaveBeenCalled();
    expect(ratingRepository.remove).not.toHaveBeenCalled();
  });
});
