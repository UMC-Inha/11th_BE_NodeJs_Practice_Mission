import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { Member } from "./entity/member.entity";
import { Rating } from "./entity/rating.entity";
import { AuthController } from "./controller/auth.controller";
import { MemberController } from "./controller/member.controller";
import { RatingController } from "./controller/rating.controller";
import { AuthService } from "./service/auth.service";
import { MemberService } from "./service/member.service";
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
    TypeOrmModule.forFeature([Member, Rating]),
    JwtModule.registerAsync({
      global: true, // 전역 등록하면 어느 서비스에서든 JwtService를 주입받을 수 있어요
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>("JWT_SECRET"),
        signOptions: {
          // 환경변수는 문자열로 들어오므로 Number()로 바꿔요
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
  ],
  providers: [AppService, AuthService, MemberService, RatingService],
})
export class AppModule {}