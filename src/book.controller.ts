import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { BookService } from './book.service.js';
import { BookResponseDto, CreateBookDto, FindBooksDto } from './book.dto.js';
@Controller('books')
export class BookController {
  constructor(private readonly bookService: BookService) {}
  @Get()
  getBooks(@Query() query: FindBooksDto): Promise<BookResponseDto[]> {
    return this.bookService.getAllBooks(query.keyword);
  }
  @Get('category/:categoryId')
  getByCategory(
    @Param('categoryId', ParseIntPipe) categoryId: number,
  ): Promise<BookResponseDto[]> {
    return this.bookService.getBooksByCategory(categoryId);
  }
  @Post()
  createBook(@Body() body: CreateBookDto): Promise<BookResponseDto> {
    return this.bookService.createBook(body);
  }
}
