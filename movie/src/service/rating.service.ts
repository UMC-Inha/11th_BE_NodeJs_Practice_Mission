import { BadRequestException, HttpStatus, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Member } from "../entity/member.entity";
import { Rating } from "../entity/rating.entity";
import { CreateRatingDto } from "../dto/create-rating.dto";
import { UpdateRatingDto } from "../dto/update-rating.dto";
import { RatingResponseDto } from "../dto/rating-response.dto";
import { ApiException } from "../exception/api.exception";

@Injectable()
export class RatingService {
  constructor(
    @InjectRepository(Rating)
    private readonly ratingRepository: Repository<Rating>,
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
  ) {}

  // 5주차에 만든 조회입니다. 예외만 ApiException으로 바꿨습니다.
  async getRatingsByMember(memberId: number): Promise<RatingResponseDto[]> {
    const member = await this.memberRepository.findOneBy({ memberId });
    if (!member) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        "MEMBER404_1",
        "해당 회원을 찾을 수 없습니다.",
      );
    }

    const ratings = await this.ratingRepository.find({
      where: { member: { memberId } },
      order: { ratingId: "DESC" },
    });

    return ratings.map(RatingResponseDto.from);
  }

  async create(
    memberId: number,
    dto: CreateRatingDto,
  ): Promise<RatingResponseDto> {
    const member = await this.memberRepository.findOneBy({ memberId });
    if (!member) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        "MEMBER404_1",
        "해당 회원을 찾을 수 없습니다.",
      );
    }

    // 같은 영화에 두 번 평점을 남기지 못하게 막습니다.
    const existingRating = await this.ratingRepository.findOne({
      where: { member: { memberId }, movieId: dto.movieId },
    });
    if (existingRating) {
      throw new ApiException(
        HttpStatus.CONFLICT,
        "RATING409_1",
        "이미 이 영화에 평점을 남기셨습니다.",
      );
    }

    const savedRating = await this.ratingRepository.save(
      this.ratingRepository.create({
        member,
        movieId: dto.movieId,
        score: dto.score,
        comment: dto.comment,
      }),
    );

    return RatingResponseDto.from(savedRating);
  }

  async update(
    memberId: number,
    ratingId: number,
    dto: UpdateRatingDto,
  ): Promise<RatingResponseDto> {
    const rating = await this.findOwnedRating(memberId, ratingId);

    if (dto.score === undefined && dto.comment === undefined) {
      throw new BadRequestException("수정할 내용이 없습니다.");
    }

    // 보낸 필드만 덮어씁니다.
    if (dto.score !== undefined) {
      rating.score = dto.score;
    }
    if (dto.comment !== undefined) {
      rating.comment = dto.comment;
    }

    const savedRating = await this.ratingRepository.save(rating);
    return RatingResponseDto.from(savedRating);
  }

  async delete(memberId: number, ratingId: number): Promise<void> {
    const rating = await this.findOwnedRating(memberId, ratingId);
    await this.ratingRepository.remove(rating);
  }

  /**
   * 평점을 찾고 그 평점이 요청자의 것인지까지 확인합니다.
   * 수정과 삭제가 똑같은 검사를 하므로 메서드로 묶었습니다.
   */
  private async findOwnedRating(
    memberId: number,
    ratingId: number,
  ): Promise<Rating> {
    const rating = await this.ratingRepository.findOne({
      where: { ratingId },
      relations: { member: true }, // 작성자를 함께 불러와야 소유권을 비교할 수 있습니다
    });

    if (!rating) {
      throw new ApiException(
        HttpStatus.NOT_FOUND,
        "RATING404_1",
        "해당 평점을 찾을 수 없습니다.",
      );
    }

    // 존재는 하지만 내 것이 아니라면 인가 실패입니다
    if (rating.member.memberId !== memberId) {
      throw new ApiException(
        HttpStatus.FORBIDDEN,
        "RATING403_1",
        "본인이 작성한 평점만 수정하거나 삭제할 수 있습니다.",
      );
    }

    return rating;
  }
}