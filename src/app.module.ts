import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { databaseProviders } from './database.provider.js';
import { BookService } from './book.service.js';
import { BookRepository } from './book.repository.js';
import { RentalController } from './rental.controller.js';
import { RentalService } from './rental.service.js';
import { RentalRepository } from './rental.repository.js';
import { BooksModule } from './books/books.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql' as const,
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 3306),
        username: configService.get<string>('DB_USER', 'root'),
        password: configService.get<string>('DB_PASSWORD', ''),
        database: configService.get<string>('DB_NAME', ''),
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),
    BooksModule,
  ],
  controllers: [AppController, RentalController],
  providers: [
    ...databaseProviders,
    AppService,
    BookService,
    BookRepository,
    RentalService,
    RentalRepository,
  ],
  exports: [...databaseProviders],
})
export class AppModule {}