import { Rating } from '../entity/rating.entity.js';

/**
 * 유저별 평점 조회 응답의 한 줄.
 * Entity를 그대로 내보내면 member(그 안의 password)까지 API 계약이 되므로
 * API 명세 표에 합의한 6개 필드만 옮긴다.
 */
export class RatingResponseDto {
  ratingId: number;
  movieId: number;
  score: number;
  comment: string | null;
  createdAt: Date;
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
