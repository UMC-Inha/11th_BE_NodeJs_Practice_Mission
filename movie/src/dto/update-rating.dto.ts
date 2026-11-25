import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class UpdateRatingDto {
  @ApiPropertyOptional({
    description: "평점 (1~5 사이의 정수). 보낸 필드만 수정됩니다.",
    example: 5,
    minimum: 1,
    maximum: 5,
  })
  @IsOptional()
  @IsInt({ message: "평점은 정수로 입력해주세요." })
  @Min(1, { message: "평점은 1점 이상이어야 합니다." })
  @Max(5, { message: "평점은 5점 이하여야 합니다." })
  score?: number;

  @ApiPropertyOptional({
    description: "한줄평 (500자 이하). 보낸 필드만 수정됩니다.",
    example: "다시 보니 더 좋네요.",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: "코멘트는 500자 이하여야 합니다." })
  comment?: string;
}