import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { buildJwtOptions } from './config/jwt.config.js';
import { AuthController } from './controller/auth.controller.js';
import { MemberController } from './controller/member.controller.js';
import { RatingController } from './controller/rating.controller.js';
import { Member } from './entity/member.entity.js';
import { Rating } from './entity/rating.entity.js';
import { AuthService } from './service/auth.service.js';
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
    // 토큰 발급(AuthService)과 검증(AuthGuard)이 같은 키·유효시간을 쓰도록 한 번만 설정한다.
    // global: true 라 어느 곳에서든 JwtService 를 주입받을 수 있다.
    // 키가 없거나 짧으면 여기서 오류가 나서 서버가 뜨지 않는다.
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        buildJwtOptions({
          JWT_SECRET: config.get<string>('JWT_SECRET'),
          JWT_ACCESS_EXPIRATION: config.get<string>('JWT_ACCESS_EXPIRATION'),
        }),
    }),
  ],
  controllers: [AuthController, MemberController, RatingController],
  providers: [AuthService, MemberService, RatingService],
})
export class AppModule {}
