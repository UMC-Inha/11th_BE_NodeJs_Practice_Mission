import { INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import { TypeOrmModule, getRepositoryToken } from "@nestjs/typeorm";
import request from "supertest";
import { Repository } from "typeorm";
import { RatingController } from "../src/controller/rating.controller";
import { Member } from "../src/entity/member.entity";
import { Rating } from "../src/entity/rating.entity";
import { HttpExceptionFilter } from "../src/filter/http-exception.filter";
import { RatingService } from "../src/service/rating.service";

describe("평점 API (통합 테스트)", () => {
  let app: INestApplication;
  let memberRepository: Repository<Member>;
  let ratingRepository: Repository<Rating>;
  let member: Member;
  let authorization: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: "sqljs",
          autoSave: false,
          entities: [Member, Rating],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([Member, Rating]),
        JwtModule.register({
          global: true,
          secret: "test-secret-for-e2e-only",
          signOptions: { expiresIn: 3600 },
        }),
      ],
      controllers: [RatingController],
      providers: [RatingService],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();

    memberRepository = moduleFixture.get(getRepositoryToken(Member));
    ratingRepository = moduleFixture.get(getRepositoryToken(Rating));

    member = await memberRepository.save(
      memberRepository.create({
        email: "challenger@umc.com",
        password: "$2b$10$abcdefghijklmnopqrstuv",
        nickname: "영화조아",
      }),
    );

    const jwtService = moduleFixture.get(JwtService);
    const token = jwtService.sign({
      sub: String(member.memberId),
      email: member.email,
    });
    authorization = `Bearer ${token}`;
  });

  beforeEach(async () => {
    await ratingRepository.clear();
  });

  afterAll(async () => {
    await app.close();
  });

  it("토큰 없이 평점을 등록하면 401과 AUTH401_2를 응답한다", async () => {
    const response = await request(app.getHttpServer())
      .post("/ratings")
      .send({ movieId: 550, score: 4, comment: "인생 영화입니다." })
      .expect(401);

    expect(response.body.isSuccess).toBe(false);
    expect(response.body.code).toBe("AUTH401_2");
  });

  it("토큰을 담아 평점을 등록하면 201과 저장된 평점을 응답한다", async () => {
    const response = await request(app.getHttpServer())
      .post("/ratings")
      .set("Authorization", authorization)
      .send({ movieId: 550, score: 4, comment: "인생 영화입니다." })
      .expect(201);

    expect(response.body.code).toBe("COMMON201");
    expect(response.body.result.movieId).toBe(550);
    expect(response.body.result.score).toBe(4);
  });
});