import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemberController } from './controller/member.controller.js';
import { RatingController } from './controller/rating.controller.js';
import { Member } from './entity/member.entity.js';
import { Rating } from './entity/rating.entity.js';
import { MemberService } from './service/member.service.js';
import { RatingService } from './service/rating.service.js';

/**
 * 도메인 모듈 없이 레이어 폴더(controller·service·entity·dto)를 쓰므로
 * 이 모듈 하나가 모든 Controller/Service/Entity를 직접 등록한다.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      // ConfigModule 이 .env 를 읽은 뒤에 접속 정보를 만든다.
      useFactory: () => ({
        type: 'mysql',
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT ?? 3306),
        username: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        autoLoadEntities: true,
        // 스키마는 sql/schema.sql 로 만들고, 코드가 테이블을 바꾸지 않게 한다.
        synchronize: false,
        // BIGINT 를 문자열이 아닌 숫자로 받는다. member/rating ID와 TMDB 영화 ID는
        // 2^53 보다 훨씬 작아서 정밀도 손실이 없고, 명세의 "ratingId": 1 모양과 맞는다.
        supportBigNumbers: true,
        bigNumberStrings: false,
      }),
    }),
    TypeOrmModule.forFeature([Member, Rating]),
  ],
  controllers: [MemberController, RatingController],
  providers: [MemberService, RatingService],
})
export class AppModule {}
