import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BooksModule } from './books.module.js';
import { databaseProviders } from './database.provider.js';
import { RentalController } from './rental.controller.js';
import { RentalService } from './rental.service.js';
import { RentalRepository } from './rental.repository.js';

@Module({
  imports: [
    // 환경 변수를 애플리케이션 전역에서 사용 가능하도록 설정
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.getOrThrow<string>('DB_HOST'),
        port: Number(config.get<string>('DB_PORT', '3306')),
        username: config.getOrThrow<string>('DB_USER'),
        password: config.get<string>('DB_PASSWORD', ''),
        database: config.getOrThrow<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize: false,
        relationLoadStrategy: 'join',
        logging: process.env.DB_LOGGING === 'true',
      }),
    }),
    BooksModule,
  ],
  controllers: [AppController, RentalController],
  providers: [
    ...databaseProviders, // 1. DB 커넥션 풀을 부품으로 등록
    AppService,
    RentalService,
    RentalRepository,
  ],
  exports: [...databaseProviders], // 2. 다른 모듈/서비스에서도 쓸 수 있게 공개
})
export class AppModule {}
