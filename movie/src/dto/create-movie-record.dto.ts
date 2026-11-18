import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * POST /movie-records 요청 Body. 평점과 즐겨찾기를 한 번에 저장하는 "영화 기록" 이다.
 * 평점 등록(CreateRatingDto)과 같은 규칙에 addToFavorites 하나가 더 붙는다.
 */
export class CreateMovieRecordDto {
  @ApiProperty({ description: 'TMDB 영화 ID (양의 정수)', example: 238 })
  // 메시지 순서: class-validator 는 아래에서 위로 평가한다(CreateFavoriteDto 설명 참고).
  @IsPositive({ message: '영화 ID는 양수여야 합니다.' })
  @IsInt({ message: '영화 ID는 정수여야 합니다.' })
  @IsNotEmpty({ message: '영화 ID는 필수입니다.' })
  movieId: number;

  @ApiProperty({
    description: '별점 (1~5 정수)',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @Max(5, { message: '별점은 5점 이하여야 합니다.' })
  @Min(1, { message: '별점은 1점 이상이어야 합니다.' })
  @IsInt({ message: '별점은 정수여야 합니다.' })
  @IsNotEmpty({ message: '별점은 필수입니다.' })
  score: number;

  @ApiPropertyOptional({
    description: '후기 (선택, 500자 이하)',
    example: '다시 보고 싶은 영화입니다.',
    maxLength: 500,
  })
  @IsOptional()
  @IsString({ message: '후기는 문자열이어야 합니다.' })
  @MaxLength(500, { message: '후기는 500자 이하로 입력해주세요.' })
  comment?: string;

  @ApiProperty({
    description:
      'true 면 평점과 즐겨찾기를 같은 트랜잭션에서 함께 저장, false 면 평점만 저장',
    example: true,
  })
  @IsBoolean({ message: '즐겨찾기 추가 여부는 true 또는 false여야 합니다.' })
  addToFavorites: boolean;
}
