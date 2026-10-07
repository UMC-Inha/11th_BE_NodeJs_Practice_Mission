// src/book.controller.ts
import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
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

  @Post()
  async createBook(@Body() body: Record<string, any>): Promise<string> {
    return this.bookService.createBook(body);
  }

  @Get()
  async getBooks(): Promise<any> {
    return await this.bookService.getAllBooks();
  }
}