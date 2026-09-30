import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { databaseProviders } from './database.provider.js';
import { BookController } from './book.controller.js';
import { BookService } from './book.service.js';
import { BookRepository } from './book.repository.js';

@Module({
  imports: [
    // 환경 변수를 애플리케이션 전역에서 사용 가능하도록 설정
    ConfigModule.forRoot({
      isGlobal: true,
    }),
  ],
  controllers: [AppController, BookController,],
  providers: [
    ...databaseProviders, // 1. DB 커넥션 풀을 부품으로 등록
    AppService,
    BookService, 
    BookRepository,
  ],
  exports: [...databaseProviders],
})
export class AppModule {}