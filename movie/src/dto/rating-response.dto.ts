import { ApiProperty } from '@nestjs/swagger';
import { Rating } from '../entity/rating.entity.js';

/**
 * 유저별 평점 조회 응답의 한 줄.
 * Entity를 그대로 내보내면 member(그 안의 password)까지 API 계약이 되므로
 * API 명세 표에 합의한 6개 필드만 옮긴다.
 */
export class RatingResponseDto {
  @ApiProperty({ example: 3 })
  ratingId: number;

  @ApiProperty({ description: 'TMDB 영화 ID', example: 238 })
  movieId: number;

  @ApiProperty({ minimum: 1, maximum: 5, example: 5 })
  score: number;

  @ApiProperty({ nullable: true, example: '다시 보고 싶은 영화입니다.' })
  comment: string | null;

  @ApiProperty({ example: '2026-11-18T05:00:00.000Z' })
  createdAt: Date;

  @ApiProperty({ example: '2026-11-18T05:00:00.000Z' })
  updatedAt: Date;

  static from(rating: Rating): RatingResponseDto {
    return {
      ratingId: rating.ratingId,
      movieId: rating.movieId,
      score: rating.score,
      comment: rating.comment,
      createdAt: rating.createdAt,
      updatedAt: rating.updatedAt,
    };
  }
}
