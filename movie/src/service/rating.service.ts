import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RatingPageQueryDto } from '../dto/member-request.dto.js';
import { RatingResponseDto } from '../dto/rating-response.dto.js';
import { Member } from '../entity/member.entity.js';
import { Rating } from '../entity/rating.entity.js';

export const DEFAULT_RATING_PAGE_SIZE = 10;

@Injectable()
export class RatingService {
  constructor(
    @InjectRepository(Rating)
    private readonly ratingRepository: Repository<Rating>,
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
  ) {}

  async getRatingsByMember(
    memberId: number,
    query: RatingPageQueryDto = {},
  ): Promise<RatingResponseDto[]> {
    // 평점이 0개인 회원(200 [])과 없는 회원(404)을 구분하려고 회원부터 확인한다.
    const exists = await this.memberRepository.exists({ where: { memberId } });
    if (!exists) {
      throw new NotFoundException('존재하지 않는 유저입니다.');
    }

    const paged = query.page !== undefined || query.size !== undefined;
    const size = query.size ?? DEFAULT_RATING_PAGE_SIZE;
    const ratings = await this.ratingRepository.find({
      where: { member: { memberId } },
      // 같은 초에 들어온 평점도 순서가 흔들리지 않게 PK 기준 최신순
      order: { ratingId: 'DESC' },
      ...(paged ? { skip: (query.page ?? 0) * size, take: size } : {}),
    });

    return ratings.map((rating) => RatingResponseDto.from(rating));
  }
}
