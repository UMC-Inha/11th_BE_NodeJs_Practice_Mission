import { INestApplication, ValidationPipe } from "@nestjs/common";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { Test, TestingModule } from "@nestjs/testing";
import { TypeOrmModule, getRepositoryToken } from "@nestjs/typeorm";
import request from "supertest";
import { Repository } from "typeorm";
import { FavoriteController } from "../src/controller/favorite.controller";
import { Favorite } from "../src/entity/favorite.entity";
import { Member } from "../src/entity/member.entity";
import { HttpExceptionFilter } from "../src/filter/http-exception.filter";
import { FavoriteService } from "../src/service/favorite.service";

describe("즐겨찾기 API (통합 테스트)", () => {
  let app: INestApplication;
  let memberRepository: Repository<Member>;
  let favoriteRepository: Repository<Favorite>;
  let member: Member;
  let authorization: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: "sqljs",
          autoSave: false,
          entities: [Member, Favorite],
          synchronize: true,
        }),
        TypeOrmModule.forFeature([Member, Favorite]),
        JwtModule.register({
          global: true,
          secret: "test-secret-for-e2e-only",
          signOptions: { expiresIn: 3600 },
        }),
      ],
      controllers: [FavoriteController],
      providers: [FavoriteService],
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
    favoriteRepository = moduleFixture.get(getRepositoryToken(Favorite));

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
    await favoriteRepository.clear();
  });

  afterAll(async () => {
    await app.close();
  });

  it("토큰 없이 즐겨찾기를 등록하면 401과 AUTH401_2를 응답한다", async () => {
    const response = await request(app.getHttpServer())
      .post("/favorites")
      .send({ movieId: 550 })
      .expect(401);

    expect(response.body.isSuccess).toBe(false);
    expect(response.body.code).toBe("AUTH401_2");
  });

  it("토큰을 담아 즐겨찾기를 등록하면 201과 저장된 영화 ID를 응답한다", async () => {
    const response = await request(app.getHttpServer())
      .post("/favorites")
      .set("Authorization", authorization)
      .send({ movieId: 550 })
      .expect(201);

    expect(response.body.code).toBe("COMMON201");
    expect(response.body.result.movieId).toBe(550);
  });

  it("이미 즐겨찾기한 영화를 다시 등록하면 409와 FAVORITE409_1을 응답한다", async () => {
    await favoriteRepository.save(
      favoriteRepository.create({ member, movieId: 550 }),
    );

    const response = await request(app.getHttpServer())
      .post("/favorites")
      .set("Authorization", authorization)
      .send({ movieId: 550 })
      .expect(409);

    expect(response.body.code).toBe("FAVORITE409_1");
  });

  it("즐겨찾기하지 않은 영화의 여부를 조회하면 200과 isFavorite false를 응답한다", async () => {
    const response = await request(app.getHttpServer())
      .get("/favorites/550")
      .set("Authorization", authorization)
      .expect(200);

    expect(response.body.result.isFavorite).toBe(false);
  });
});