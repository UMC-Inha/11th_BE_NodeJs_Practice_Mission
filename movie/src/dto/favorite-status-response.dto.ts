import { ApiProperty } from '@nestjs/swagger';

/** GET /favorites/{movieId} 응답. 즐겨찾기하지 않았어도 오류가 아니라 isFavorite: false 인 정상 상태다. */
export class FavoriteStatusResponseDto {
  @ApiProperty({ example: true })
  isFavorite: boolean;

  static from(isFavorite: boolean): FavoriteStatusResponseDto {
    return { isFavorite };
  }
}
