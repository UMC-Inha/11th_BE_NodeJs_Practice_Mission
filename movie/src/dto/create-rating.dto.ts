import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class CreateRatingDto {
  @ApiProperty({ description: "TMDB 영화 ID", example: 550 })
  @IsInt({ message: "movieId는 정수여야 합니다." })
  @Min(1, { message: "movieId는 1 이상이어야 합니다." })
  movieId: number;

  @ApiProperty({ description: "평점 (1~5 사이의 정수)", example: 4, minimum: 1, maximum: 5 })
  @IsInt({ message: "평점은 정수로 입력해주세요." })
  @Min(1, { message: "평점은 1점 이상이어야 합니다." })
  @Max(5, { message: "평점은 5점 이하여야 합니다." })
  score: number;

  @ApiPropertyOptional({
    description: "한줄평 (500자 이하)",
    example: "인생 영화입니다.",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: "코멘트는 500자 이하여야 합니다." })
  comment?: string;
}