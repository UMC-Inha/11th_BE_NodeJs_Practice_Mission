import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ApiException } from "../exception/api.exception";
import { Favorite } from "../entity/favorite.entity";
import { Member } from "../entity/member.entity";
import { FavoriteService } from "./favorite.service";

describe("FavoriteService", () => {
  let favoriteService: FavoriteService;

  const favoriteRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    create: jest.fn(),
  };
  const memberRepository = {
    findOneBy: jest.fn(),
  };

  const member = { memberId: 1, nickname: "영화조아" } as Member;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FavoriteService,
        { provide: getRepositoryToken(Favorite), useValue: favoriteRepository },
        { provide: getRepositoryToken(Member), useValue: memberRepository },
      ],
    }).compile();

    favoriteService = module.get<FavoriteService>(FavoriteService);
  });

  it("아직 즐겨찾기하지 않은 영화면 즐겨찾기를 저장한다", async () => {
    memberRepository.findOneBy.mockResolvedValue(member);
    favoriteRepository.findOne.mockResolvedValue(null);
    favoriteRepository.create.mockReturnValue({ member, movieId: 550 });
    favoriteRepository.save.mockResolvedValue({
      favoriteId: 1,
      movieId: 550,
      createdAt: new Date("2026-11-25T21:00:00.000Z"),
    });

    const response = await favoriteService.create(1, { movieId: 550 });

    expect(response.movieId).toBe(550);
    expect(favoriteRepository.save).toHaveBeenCalledTimes(1);
  });

  it("이미 즐겨찾기한 영화면 FAVORITE409_1 예외를 던지고 저장하지 않는다", async () => {
    memberRepository.findOneBy.mockResolvedValue(member);
    favoriteRepository.findOne.mockResolvedValue({
      favoriteId: 1,
      movieId: 550,
    });

    await expect(favoriteService.create(1, { movieId: 550 })).rejects.toThrow(
      ApiException,
    );
    expect(favoriteRepository.save).not.toHaveBeenCalled();
  });
});