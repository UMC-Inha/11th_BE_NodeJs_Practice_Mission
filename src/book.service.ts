// src/book.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Book } from './book.entity.js';
import { Category } from './category.entity.js';
import { BookResponseDto } from './book-response.dto.js';
import type { CreateBookDto } from './create-book.dto.js';
import { BookRepository } from './book.repository.js';

@Injectable()
export class BookService {
  constructor(
    private readonly bookRepository: BookRepository,
    @InjectRepository(Book)
    private readonly ormBookRepository: Repository<Book>,
    @InjectRepository(Category)
    private readonly categoryRepository: Repository<Category>,
  ) {}

  async getBooksByCategory(categoryId: number) {
    if (!Number.isSafeInteger(categoryId) || categoryId <= 0) {
      throw new BadRequestException('categoryId는 양의 정수여야 합니다.');
    }
    return this.bookRepository.findByCategoryId(categoryId);
  }

  async getAllBooks(): Promise<BookResponseDto[]> {
    const books = await this.ormBookRepository.find({
      relations: { category: true },
      order: { bookId: 'DESC' },
    });
    return books.map((book) => BookResponseDto.from(book));
  }

  async createBook(body: CreateBookDto): Promise<BookResponseDto> {
    const category = await this.categoryRepository.findOneBy({
      categoryId: body.categoryId,
    });
    if (!category) {
      throw new NotFoundException('존재하지 않는 카테고리입니다.');
    }

    const book = this.ormBookRepository.create({
      category,
      title: body.title,
      description: body.description ?? null,
      isAvailable: true,
    });
    const savedBook = await this.ormBookRepository.save(book);
    return BookResponseDto.from(savedBook);
  }
}