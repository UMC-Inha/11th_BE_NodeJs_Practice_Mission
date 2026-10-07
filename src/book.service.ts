// src/book.service.ts
import { BadRequestException, Injectable } from '@nestjs/common';
import { BookRepository } from './book.repository.js';

@Injectable()
export class BookService {
  constructor(private readonly bookRepository: BookRepository) {}

  async getBooksByCategory(categoryId: number) {
    if (!Number.isSafeInteger(categoryId) || categoryId <= 0) {
      throw new BadRequestException('categoryId는 양의 정수여야 합니다.');
    }
    return this.bookRepository.findByCategoryId(categoryId);
  }

  async getAllBooks(): Promise<any> {
    return await this.bookRepository.findAll();
  }

  async createBook(body: Record<string, any>): Promise<string> {
    await this.bookRepository.create(body);
    return '도서 등록이 완료되었습니다!';
  }
}