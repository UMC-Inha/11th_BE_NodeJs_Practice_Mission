import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateRatingDto } from '../dto/create-rating.dto.js';
import { RatingPageQueryDto } from '../dto/member-request.dto.js';
import { RatingResponseDto } from '../dto/rating-response.dto.js';
import { UpdateRatingDto } from '../dto/update-rating.dto.js';
import { Member } from '../entity/member.entity.js';
import { Rating } from '../entity/rating.entity.js';
import {
  memberNotFound,
  ratingDuplicated,
  ratingForbidden,
  ratingNotFound,
} from '../exception/api.exception.js';

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
      throw memberNotFound();
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

  /** 새 평점을 저장하고 ratingId 를 돌려준다. */
  async create(memberId: number, dto: CreateRatingDto): Promise<number> {
    const member = await this.memberRepository.findOneBy({ memberId });
    if (!member) {
      throw memberNotFound();
    }

    // (member_id, movie_id) 복합 UNIQUE 가 DB에도 걸려 있다. 그냥 저장해도 막히지만,
    // 우리가 정한 code/message 로 응답하려고 먼저 확인한다. 동시 요청은 DB 가 최종으로 막는다.
    const existing = await this.ratingRepository.exists({
      where: { member: { memberId }, movieId: dto.movieId },
    });
    if (existing) {
      throw ratingDuplicated();
    }

    const saved = await this.ratingRepository.save(
      this.ratingRepository.create({
        member,
        movieId: dto.movieId,
        score: dto.score,
        comment: dto.comment ?? null,
      }),
    );

    return saved.ratingId;
  }

  async update(
    ratingId: number,
    memberId: number,
    dto: UpdateRatingDto,
  ): Promise<void> {
    const rating = await this.findOwnedRating(ratingId, memberId);

    rating.score = dto.score;
    // PATCH 이므로 생략된 필드는 건드리지 않는다. 후기를 지우려면 null 을 보낸다.
    if (dto.comment !== undefined) {
      rating.comment = dto.comment;
    }

    await this.ratingRepository.save(rating);
  }

  async delete(ratingId: number, memberId: number): Promise<void> {
    const rating = await this.findOwnedRating(ratingId, memberId);

    await this.ratingRepository.remove(rating);
  }

  /**
   * 평점을 찾고, 그 평점이 요청자의 것인지까지 확인한다.
   * 먼저 찾아보고(없으면 404), 찾았으면 주인을 본다(내 것이 아니면 403).
   */
  private async findOwnedRating(
    ratingId: number,
    memberId: number,
  ): Promise<Rating> {
    const rating = await this.ratingRepository.findOne({
      where: { ratingId },
      relations: { member: true }, // 작성자를 함께 불러와야 소유권을 비교할 수 있다
    });

    if (!rating) {
      throw ratingNotFound();
    }

    if (rating.member.memberId !== memberId) {
      throw ratingForbidden();
    }

    return rating;
  }
}
