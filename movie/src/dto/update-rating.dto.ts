import { IsInt, IsOptional, IsString, Max, MaxLength, Min, ValidateIf } from 'class-validator';

export class UpdateRatingDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(5)
  score?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string | null;
}
