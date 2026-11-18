import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { CreateRatingDto } from "../dto/create-rating.dto.js";
import { UpdateRatingDto } from "../dto/update-rating.dto.js";
import { RatingService } from "../service/rating.service.js";

import type { Request } from "express";
import { ApiException } from "../exception/api.exception.js";
import { AuthGuard } from "../guard/auth.guard.js";

@Controller()
export class RatingController {
  constructor(private readonly ratingService: RatingService) {}

  @Get("members/:memberId/ratings")
  getMemberRatings(@Param("memberId", ParseIntPipe) memberId: number) {
    return this.ratingService.getRatingsByMember(memberId);
  }

  @Post("ratings")
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() request: Request & { memberId?: number },
    @Body() dto: CreateRatingDto,
  ) {
    const result = await this.ratingService.create(this.getRequestMemberId(request), dto);
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
  async update(
    @Req() request: Request & { memberId?: number },
    @Param("ratingId", ParseIntPipe) ratingId: number,
    @Body() dto: UpdateRatingDto,
  ) {
    const result = await this.ratingService.update(
      this.getRequestMemberId(request),
      ratingId,
      dto,
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
  async delete(
    @Req() request: Request & { memberId?: number },
    @Param("ratingId", ParseIntPipe) ratingId: number,
  ) {
    await this.ratingService.delete(this.getRequestMemberId(request), ratingId);
    return {
      isSuccess: true,
      code: "COMMON200",
      message: "평점을 삭제했습니다.",
      result: null,
    };
  }

  private getRequestMemberId(request: Request & { memberId?: number }): number {
    const memberId = request.memberId;
    if (memberId === undefined || !Number.isSafeInteger(memberId) || memberId < 1) {
      throw new ApiException(HttpStatus.UNAUTHORIZED, "AUTH401_3", "유효하지 않은 토큰입니다.");
    }
    return memberId;
  }
}