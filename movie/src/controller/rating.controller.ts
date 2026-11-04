import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from "@nestjs/common";
import { CreateRatingDto } from "../dto/create-rating.dto";
import { UpdateRatingDto } from "../dto/update-rating.dto";
import { RatingService } from "../service/rating.service";

@Controller("members")
export class RatingController {
  constructor(private readonly ratingService: RatingService) {}

  @Get(":memberId/ratings")
  getMemberRatings(@Param("memberId", ParseIntPipe) memberId: number) {
    return this.ratingService.getRatingsByMember(memberId);
  }

  @Post(":memberId/ratings")
  @HttpCode(HttpStatus.CREATED)
  async createRating(
    @Param("memberId", ParseIntPipe) memberId: number,
    @Body() createRatingDto: CreateRatingDto,
  ) {
    const result = await this.ratingService.create(memberId, createRatingDto);

    return {
      isSuccess: true,
      code: "COMMON201",
      message: "평점이 등록되었습니다.",
      result,
    };
  }

  @Patch(":memberId/ratings/:ratingId")
  async updateRating(
    @Param("memberId", ParseIntPipe) memberId: number,
    @Param("ratingId", ParseIntPipe) ratingId: number,
    @Body() updateRatingDto: UpdateRatingDto,
  ) {
    const result = await this.ratingService.update(
      memberId,
      ratingId,
      updateRatingDto,
    );

    return {
      isSuccess: true,
      code: "COMMON200",
      message: "평점이 수정되었습니다.",
      result,
    };
  }

  @Delete(":memberId/ratings/:ratingId")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRating(
    @Param("memberId", ParseIntPipe) memberId: number,
    @Param("ratingId", ParseIntPipe) ratingId: number,
  ) {
    await this.ratingService.delete(memberId, ratingId);
  }
}