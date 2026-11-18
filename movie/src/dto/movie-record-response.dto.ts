import { ApiProperty } from '@nestjs/swagger';
import { FavoriteResponseDto } from './favorite-response.dto.js';
import { RatingResponseDto } from './rating-response.dto.js';

/** POST /movie-records 응답. addToFavorites 가 false 였으면 favorite 은 null 이다. */
export class MovieRecordResponseDto {
  @ApiProperty({ type: () => RatingResponseDto })
  rating: RatingResponseDto;

  @ApiProperty({ type: () => FavoriteResponseDto, nullable: true })
  favorite: FavoriteResponseDto | null;

  static of(
    rating: RatingResponseDto,
    favorite: FavoriteResponseDto | null,
  ): MovieRecordResponseDto {
    return { rating, favorite };
  }
}
