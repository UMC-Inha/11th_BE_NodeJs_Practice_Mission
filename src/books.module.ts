import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Book } from './book.entity.js';
import { Category } from './category.entity.js';
import { BookController } from './book.controller.js';
import { BookService } from './book.service.js';
@Module({
  imports: [TypeOrmModule.forFeature([Book, Category])],
  controllers: [BookController],
  providers: [BookService],
})
export class BooksModule {}
