// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { databaseProviders } from './database.provider.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { BookController } from './book.controller.js';
import { BookService } from './book.service.js';
import { BookRepository } from './book.repository.js';

import { RentalController } from './rental.controller.js';
import { RentalService } from './rental.service.js';
import { RentalRepository } from './rental.repository.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [
    AppController,
    RentalController,
    BookController, // 추가!
  ],
  providers: [
    ...databaseProviders,
    AppService,
    RentalService,
    RentalRepository,
    BookService, // 추가!
    BookRepository, // 추가
  ],
  exports: [...databaseProviders],
})
export class AppModule {}