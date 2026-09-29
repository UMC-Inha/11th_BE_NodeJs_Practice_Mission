// src/book.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { BookService } from './book.service.js';

@Controller('books') // 이 컨트롤러로 들어오는 기본 주소: /books
export class BookController {
  // 주방장(BookService)을 주입받습니다.
  constructor(private readonly bookService: BookService) {}

  // GET http://localhost:3000/books
  @Get()
  async getBooks(): Promise<any> {
    return await this.bookService.getAllBooks();
  }

  // POST http://localhost:3000/books
  @Post()
  async createBook(@Body() body: Record<string, any>): Promise<string> {
    return await this.bookService.createBook(body);
  }

  // GET http://localhost:3000/books/category/1
  // Path Variable(경로 변수)로 categoryId를 받습니다.
  // ParseIntPipe는 Spring의 @PathVariable Long처럼 숫자로 바꿔 주고, 숫자가 아니면 400으로 돌려보냅니다.
  @Get('category/:categoryId')
  async getBooksByCategory(
    @Param('categoryId', ParseIntPipe) categoryId: number,
  ): Promise<any> {
    return await this.bookService.getBooksByCategory(categoryId);
  }
}
