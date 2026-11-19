import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { Favorite } from "./entity/favorite.entity";
import { Member } from "./entity/member.entity";
import { Rating } from "./entity/rating.entity";
import { AuthController } from "./controller/auth.controller";
import { FavoriteController } from "./controller/favorite.controller";
import { MemberController } from "./controller/member.controller";
import { MovieRecordController } from "./controller/movie-record.controller";
import { RatingController } from "./controller/rating.controller";
import { AuthService } from "./service/auth.service";
import { FavoriteService } from "./service/favorite.service";
import { MemberService } from "./service/member.service";
import { MovieRecordService } from "./service/movie-record.service";
import { RatingService } from "./service/rating.service";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: "mysql",
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
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET"),
        signOptions: {
          expiresIn: Number(
            configService.get<string>("JWT_ACCESS_EXPIRATION") ?? 3600,
          ),
        },
      }),
    }),
  ],
  controllers: [
    AppController,
    AuthController,
    MemberController,
    RatingController,
    FavoriteController,
    MovieRecordController,
  ],
  providers: [
    AppService,
    AuthService,
    MemberService,
    RatingService,
    FavoriteService,
    MovieRecordService,
  ],
})
export class AppModule {}