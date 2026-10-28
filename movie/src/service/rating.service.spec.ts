import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { Member } from '../entity/member.entity.js';
import { Rating } from '../entity/rating.entity.js';
import { RatingService } from './rating.service.js';

const createdAt = new Date('2026-08-26T01:00:00Z');

function rating(id: number, movieId: number): Rating {
  return {
    ratingId: id,
    movieId,
    score: 5,
    comment: null,
    createdAt,
    updatedAt: createdAt,
    member: {
      memberId: 1,
      email: 'noco@umc.com',
      password: '$2a$10$dummyEncodedPasswordValue',
      nickname: '수현',
      createdAt,
      updatedAt: createdAt,
    },
  };
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

  it('없는 회원이면 404', async () => {
    const { service, ratingRepository } = setup(false);
    await expect(service.getRatingsByMember(999)).rejects.toBeInstanceOf(
      NotFoundException,
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
