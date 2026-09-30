// src/book.controller.ts
import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { BookService } from './book.service.js';

@Controller('books') // 이 컨트롤러로 들어오는 기본 주소: /books
export class BookController {
  // 주방장(BookService)을 주입받습니다.
  constructor(private readonly bookService: BookService) {}

  @Get('category/:categoryId')
  async getBooksByCategory(
    @Param('categoryId', ParseIntPipe) categoryId: number,
  ) {
    return this.bookService.getBooksByCategory(categoryId);
  }

  // HTTP GET 방식으로 /books 요청이 들어왔을 때 실행되는 핸들러
  @Get()
  async getBooks(): Promise<any> {
    return await this.bookService.getAllBooks();
  }
}