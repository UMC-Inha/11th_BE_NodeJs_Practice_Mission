import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/** POST /ratings 요청 Body. 누가 남기는지는 Body 가 아니라 토큰이 알려 준다(memberId 없음). */
export class CreateRatingDto {
  // TMDB 가 부여한 영화 ID. 우리 DB 에 영화 테이블이 없어서 존재 여부는 확인하지 않는다.
  @ApiProperty({
    description: 'TMDB 영화 ID (양의 정수)',
    example: 238,
    minimum: 1,
  })
  @IsInt({ message: '영화 ID는 정수여야 합니다.' })
  @Min(1, { message: '영화 ID는 양수여야 합니다.' })
  movieId: number;

  @ApiProperty({
    description: '별점 (1~5 정수)',
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @IsInt({ message: '별점은 정수여야 합니다.' })
  @Min(1, { message: '별점은 1점 이상이어야 합니다.' })
  @Max(5, { message: '별점은 5점 이하여야 합니다.' })
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
}
