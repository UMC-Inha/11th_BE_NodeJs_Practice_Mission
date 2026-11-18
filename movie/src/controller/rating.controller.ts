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
  Req,
  UseGuards,
} from "@nestjs/common";
import { RatingService } from "../service/rating.service";
import { CreateRatingDto } from "../dto/create-rating.dto";
import { UpdateRatingDto } from "../dto/update-rating.dto";
import { AuthGuard } from "../guard/auth.guard";
// 데코레이터가 붙은 매개변수의 타입은 import type으로 가져와야 합니다
import type { AuthenticatedRequest } from "../guard/auth.guard";

@Controller()
export class RatingController {
  constructor(private readonly ratingService: RatingService) {}

  // 5주차에 만든 유저별 평점 조회입니다. 공개 API라 AuthGuard를 붙이지 않습니다.
  @Get("members/:memberId/ratings")
  getMemberRatings(@Param("memberId", ParseIntPipe) memberId: number) {
    return this.ratingService.getRatingsByMember(memberId);
  }

  // 경로에서 members/:memberId가 사라지고 memberId는 Guard가 담아둔 값을 씁니다
  @Post("ratings")
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createRating(
    @Req() request: AuthenticatedRequest,
    @Body() createRatingDto: CreateRatingDto,
  ) {
    const result = await this.ratingService.create(
      request.memberId,
      createRatingDto,
    );

    return {
      isSuccess: true,
      code: "COMMON201",
      message: "평점을 등록했습니다.",
      result,
    };
  }

  @Patch("ratings/:ratingId")
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async updateRating(
    @Req() request: AuthenticatedRequest,
    @Param("ratingId", ParseIntPipe) ratingId: number,
    @Body() updateRatingDto: UpdateRatingDto,
  ) {
    const result = await this.ratingService.update(
      request.memberId,
      ratingId,
      updateRatingDto,
    );

    return {
      isSuccess: true,
      code: "COMMON200",
      message: "평점을 수정했습니다.",
      result,
    };
  }

  @Delete("ratings/:ratingId")
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  async deleteRating(
    @Req() request: AuthenticatedRequest,
    @Param("ratingId", ParseIntPipe) ratingId: number,
  ) {
    await this.ratingService.delete(request.memberId, ratingId);

    return {
      isSuccess: true,
      code: "COMMON200",
      message: "평점을 삭제했습니다.",
      result: null,
    };
  }
}