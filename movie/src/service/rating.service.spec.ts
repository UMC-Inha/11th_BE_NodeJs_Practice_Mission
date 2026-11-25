import { HttpStatus } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { ApiException } from "../exception/api.exception";
import { Member } from "../entity/member.entity";
import { Rating } from "../entity/rating.entity";
import { RatingService } from "./rating.service";

describe("RatingService", () => {
  let ratingService: RatingService;

  const ratingRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const memberRepository = {
    findOneBy: jest.fn(),
  };

  const member = { memberId: 1, nickname: "영화조아" } as Member;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RatingService,
        { provide: getRepositoryToken(Rating), useValue: ratingRepository },
        { provide: getRepositoryToken(Member), useValue: memberRepository },
      ],
    }).compile();

    ratingService = module.get<RatingService>(RatingService);
  });

  it("이미 평점을 남긴 영화에 다시 등록하면 409 RATING409_1을 던지고 저장하지 않는다", async () => {
    memberRepository.findOneBy.mockResolvedValue(member);
    ratingRepository.findOne.mockResolvedValue({
      ratingId: 1,
      movieId: 550,
      score: 4,
      comment: "인생 영화입니다.",
    });

    const error = await ratingService
      .create(1, { movieId: 550, score: 5, comment: "또 봤습니다." })
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiException);
    expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(error.code).toBe("RATING409_1");
    expect(ratingRepository.save).not.toHaveBeenCalled();
  });

  it("남이 작성한 평점을 수정하려 하면 403 RATING403_1을 던지고 저장하지 않는다", async () => {
    ratingRepository.findOne.mockResolvedValue({
      ratingId: 1,
      movieId: 550,
      score: 4,
      comment: "좋았습니다.",
      member: { memberId: 2 },
    });

    const error = await ratingService
      .update(1, 1, { score: 1 })
      .catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiException);
    expect(error.getStatus()).toBe(HttpStatus.FORBIDDEN);
    expect(error.code).toBe("RATING403_1");
    expect(ratingRepository.save).not.toHaveBeenCalled();
  });
});