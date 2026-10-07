import { Controller, Get } from '@nestjs/common';
import { BooksService } from './books.service.js';
import { BookResponseDto } from './dto/book-response.dto.js';

@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Get()
  getBooks(): Promise<BookResponseDto[]> {
    return this.booksService.getBooks();
  }
}