import { Rating } from '../entity/rating.entity.js';

export class RatingResponseDto {
  ratingId: number;
  movieId: string;
  score: number;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;

  static from(rating: Rating): RatingResponseDto {
    return {
      ratingId: rating.ratingId,
      movieId: String(rating.movieId),
      score: rating.score,
      comment: rating.comment,
      createdAt: rating.createdAt,
      updatedAt: rating.updatedAt,
    };
  }
}