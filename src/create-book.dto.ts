import { Type } from 'class-transformer';
import {IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min} from 'class-validator';

export class CreateBookDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  categoryId: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;

  @IsOptional()
  @IsString()
  description?: string;
}