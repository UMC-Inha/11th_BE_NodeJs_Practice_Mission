import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './controller/auth.controller.js';
import { FavoriteController } from './controller/favorite.controller.js';
import { MemberController } from './controller/member.controller.js';
import { MovieRecordController } from './controller/movie-record.controller.js';
import { RatingController } from './controller/rating.controller.js';
import { Favorite } from './entity/favorite.entity.js';
import { Member } from './entity/member.entity.js';
import { Rating } from './entity/rating.entity.js';
import { AuthService } from './service/auth.service.js';
import { FavoriteService } from './service/favorite.service.js';
import { MemberService } from './service/member.service.js';
import { MovieRecordService } from './service/movie-record.service.js';
import { RatingService } from './service/rating.service.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST,
      port: 3306,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      autoLoadEntities: true,
      synchronize: false,
    }),
    TypeOrmModule.forFeature([Member, Rating, Favorite]),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret?.trim()) {
          throw new Error(
            'JWT_SECRET에 비어 있지 않은 서명 키를 설정해야 합니다.',
          );
        }

        const configuredExpiration = configService.get<string>(
          'JWT_ACCESS_EXPIRATION',
        );
        const expiresIn =
          configuredExpiration === undefined
            ? 3600
            : Number(configuredExpiration);
        if (
          (configuredExpiration !== undefined &&
            !/^[0-9]+$/.test(configuredExpiration.trim())) ||
          !Number.isSafeInteger(expiresIn) ||
          expiresIn < 1
        ) {
          throw new Error('JWT_ACCESS_EXPIRATION은 양의 정수(초)여야 합니다.');
        }

        return { secret, signOptions: { expiresIn } };
      },
    }),
  ],
  controllers: [
    AuthController,
    MemberController,
    RatingController,
    FavoriteController,
    MovieRecordController,
  ],
  providers: [
    AuthService,
    MemberService,
    RatingService,
    FavoriteService,
    MovieRecordService,
  ],
})
export class AppModule {}