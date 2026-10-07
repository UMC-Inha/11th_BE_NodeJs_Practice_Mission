import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Book } from './book.entity.js';
import { Category } from './category.entity.js';
import { BookController } from './book.controller.js';
import { BookService } from './book.service.js';
import { BookRepository } from './book.repository.js';
import { DatabaseModule } from './database.module.js';

@Module({
  imports: [TypeOrmModule.forFeature([Book, Category]), DatabaseModule],
  controllers: [BookController],
  providers: [BookService, BookRepository],
})
export class BooksModule {}