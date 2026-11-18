import { ApiProperty } from '@nestjs/swagger';
import { Favorite } from '../entity/favorite.entity.js';

/** 즐겨찾기 응답. Entity 를 그대로 내보내면 member(그 안의 password)까지 계약이 되므로 필요한 세 필드만 옮긴다. */
export class FavoriteResponseDto {
  @ApiProperty({ example: 1 })
  favoriteId: number;

  @ApiProperty({ description: 'TMDB 영화 ID', example: 550 })
  movieId: number;

  @ApiProperty({ example: '2026-11-18T05:00:00.000Z' })
  createdAt: Date;

  static from(favorite: Favorite): FavoriteResponseDto {
    return {
      favoriteId: favorite.favoriteId,
      movieId: favorite.movieId,
      createdAt: favorite.createdAt,
    };
  }
}
