// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { databaseProviders } from './database.provider.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { BookController } from './book.controller.js';
import { BookService } from './book.service.js';
import { BookRepository } from './book.repository.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [
    AppController,
    BookController, // 추가!
  ],
  providers: [
    ...databaseProviders,
    AppService,
    BookService, // 추가!
    BookRepository, // 추가
  ],
  exports: [...databaseProviders],
})
export class AppModule {}
