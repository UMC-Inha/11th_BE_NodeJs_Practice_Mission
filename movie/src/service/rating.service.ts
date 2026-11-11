import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { Rating } from "../entity/rating.entity";
import { Member } from "../entity/member.entity";
import { RatingResponseDto } from "../dto/rating-response.dto";
import { CreateRatingDto } from "../dto/create-rating.dto";
import { UpdateRatingDto } from "../dto/update-rating.dto";

@Injectable()
export class RatingService {
  constructor(
    @InjectRepository(Rating)
    private readonly ratingRepository: Repository<Rating>,
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
  ) {}

  async getRatingsByMember(memberId: number): Promise<RatingResponseDto[]> {
    const member = await this.memberRepository.findOneBy({ memberId });
    if (!member) {
      throw new NotFoundException("존재하지 않는 유저입니다.");
    }

    const ratings = await this.ratingRepository.find({
      where: { member: { memberId } },
      order: { ratingId: "DESC" },
    });

    return ratings.map(RatingResponseDto.from);
  }

  async create(memberId: number, dto: CreateRatingDto) {
    const member = await this.memberRepository.findOneBy({ memberId });
    if (!member) {
      throw new NotFoundException("존재하지 않는 유저입니다.");
    }

    // 같은 영화에 두 번 평점을 남기지 못하게 막아요.
    const existingRating = await this.ratingRepository.findOne({
      where: { member: { memberId }, movieId: dto.movieId },
    });
    if (existingRating) {
      throw new ConflictException("이미 평가한 영화입니다.");
    }

    const savedRating = await this.ratingRepository.save(
      this.ratingRepository.create({
        member,
        movieId: dto.movieId,
        score: dto.score,
        comment: dto.comment,
      }),
    );

    return {
      ratingId: savedRating.ratingId,
      movieId: savedRating.movieId,
      score: savedRating.score,
      comment: savedRating.comment,
    };
  }

  async update(memberId: number, ratingId: number, dto: UpdateRatingDto) {
    const rating = await this.findOwnedRating(memberId, ratingId);

    if (dto.score === undefined && dto.comment === undefined) {
      throw new BadRequestException("수정할 내용이 없습니다.");
    }

    // 보낸 필드만 덮어써요.
    if (dto.score !== undefined) {
      rating.score = dto.score;
    }
    if (dto.comment !== undefined) {
      rating.comment = dto.comment;
    }

    const savedRating = await this.ratingRepository.save(rating);

    return {
      ratingId: savedRating.ratingId,
      movieId: savedRating.movieId,
      score: savedRating.score,
      comment: savedRating.comment,
    };
  }

  async delete(memberId: number, ratingId: number) {
    const rating = await this.findOwnedRating(memberId, ratingId);
    await this.ratingRepository.remove(rating);
  }

  // 평점이 존재하는지, 그리고 요청한 회원의 것인지 함께 확인해요.
  private async findOwnedRating(memberId: number, ratingId: number) {
    const rating = await this.ratingRepository.findOne({
      where: { ratingId },
      relations: { member: true },
    });

    if (!rating) {
      throw new NotFoundException("존재하지 않는 평점입니다.");
    }

    if (rating.member.memberId !== memberId) {
      throw new ForbiddenException(
        "본인이 등록한 평점만 수정하거나 삭제할 수 있습니다.",
      );
    }

    return rating;
  }
}