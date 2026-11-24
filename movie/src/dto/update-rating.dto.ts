import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * PATCH /ratings/{ratingId} 요청 Body.
 * movieId 는 바꿀 수 없다(다른 영화의 평점이 되려면 새로 등록한다).
 */
export class UpdateRatingDto {
  @ApiProperty({
    description: '별점 (1~5 정수)',
    example: 4,
    minimum: 1,
    maximum: 5,
  })
  @IsInt({ message: '별점은 정수여야 합니다.' })
  @Min(1, { message: '별점은 1점 이상이어야 합니다.' })
  @Max(5, { message: '별점은 5점 이하여야 합니다.' })
  score: number;

  // 생략하면 기존 후기를 그대로 두고, null 을 보내면 후기를 지운다.
  @ApiPropertyOptional({
    description:
      '후기. 생략하면 기존 후기를 유지하고, null 을 보내면 후기를 지운다 (500자 이하)',
    example: '두 번째 보니 더 좋았습니다.',
    nullable: true,
    maxLength: 500,
  })
  @IsOptional()
  @IsString({ message: '후기는 문자열이어야 합니다.' })
  @MaxLength(500, { message: '후기는 500자 이하로 입력해주세요.' })
  comment?: string | null;
}
