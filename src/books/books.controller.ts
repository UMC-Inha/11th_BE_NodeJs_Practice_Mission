import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { BooksService } from './books.service.js';
import { CreateBookDto } from './dto/create-book.dto.js';
import { BookResponseDto } from './dto/book-response.dto.js';

@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Get()
  getBooks(): Promise<BookResponseDto[]> {
    return this.booksService.getBooks();
  }

  @Post()
  @HttpCode(201)
  createBook(@Body() dto: CreateBookDto): Promise<BookResponseDto> {
    return this.booksService.createBook(dto);
  }
}