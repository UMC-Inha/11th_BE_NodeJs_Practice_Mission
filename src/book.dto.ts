import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type { Book } from './book.entity.js';
export class CreateBookDto {
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  categoryId: number;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  title: string;
  @IsOptional()
  @IsString()
  description?: string | null;
}
export class FindBooksDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string;
}
export class BookResponseDto {
  bookId: string;
  title: string;
  description: string | null;
  categoryName: string;
  isAvailable: boolean;
  static from(book: Book): BookResponseDto {
    return {
      bookId: String(book.bookId),
      title: book.title,
      description: book.description,
      categoryName: book.category.name,
      isAvailable: book.isAvailable,
    };
  }
}
