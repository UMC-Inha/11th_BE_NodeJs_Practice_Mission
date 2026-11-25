import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsPositive } from 'class-validator';

/** POST /favorites 요청 Body. 누가 즐겨찾기하는지는 Body 가 아니라 토큰이 알려 준다(memberId 없음). */
export class CreateFavoriteDto {
  @ApiProperty({
    description: 'TMDB 영화 ID (양의 정수)',
    example: 550,
    minimum: 1,
  })
  // class-validator 는 데코레이터를 아래에서 위로 평가하고, 응답에는 그 순서의 첫 메시지를 보여 준다.
  // 값이 아예 없을 때 "양수여야 합니다" 가 아니라 "필수입니다" 가 먼저 나오게 IsNotEmpty 를 맨 아래에 둔다.
  @IsPositive({ message: '영화 ID는 양수여야 합니다.' })
  @IsInt({ message: '영화 ID는 정수여야 합니다.' })
  @IsNotEmpty({ message: '영화 ID는 필수입니다.' })
  movieId: number;
}
