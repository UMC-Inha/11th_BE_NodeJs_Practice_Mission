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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { RatingService } from "../service/rating.service";
import { CreateRatingDto } from "../dto/create-rating.dto";
import { UpdateRatingDto } from "../dto/update-rating.dto";
import { AuthGuard } from "../guard/auth.guard";
// 데코레이터가 붙은 매개변수의 타입은 import type으로 가져와야 합니다
import type { AuthenticatedRequest } from "../guard/auth.guard";

@ApiTags("평점")
@Controller()
export class RatingController {
  constructor(private readonly ratingService: RatingService) {}

  // 5주차에 만든 유저별 평점 조회입니다. 공개 API라 AuthGuard를 붙이지 않습니다.
  @ApiOperation({
    summary: "유저별 평점 조회",
    description:
      "특정 회원이 남긴 평점 목록을 최신순으로 조회합니다. 토큰이 필요 없는 공개 API입니다.",
  })
  @ApiParam({ name: "memberId", description: "조회할 회원의 ID", example: 1 })
  @ApiResponse({
    status: 200,
    description: "조회 성공",
    schema: {
      example: [
        {
          ratingId: 2,
          movieId: 550,
          score: 4,
          comment: "인생 영화입니다.",
          createdAt: "2026-11-25T21:00:00.000Z",
          updatedAt: "2026-11-25T21:00:00.000Z",
        },
      ],
    },
  })
  @ApiResponse({
    status: 404,
    description: "해당 회원이 존재하지 않음 (MEMBER404_1)",
  })
  @Get("members/:memberId/ratings")
  getMemberRatings(@Param("memberId", ParseIntPipe) memberId: number) {
    return this.ratingService.getRatingsByMember(memberId);
  }

  // 경로에서 members/:memberId가 사라지고 memberId는 Guard가 담아둔 값을 씁니다
  @ApiBearerAuth("bearerAuth")
  @ApiOperation({
    summary: "평점 등록",
    description:
      "토큰의 주인인 회원이 영화 하나에 평점과 한줄평을 남깁니다. 한 영화에는 한 번만 남길 수 있습니다. 토큰이 필요합니다.",
  })
  @ApiResponse({
    status: 201,
    description: "평점 등록 성공",
    schema: {
      example: {
        isSuccess: true,
        code: "COMMON201",
        message: "평점을 등록했습니다.",
        result: {
          ratingId: 1,
          movieId: 550,
          score: 4,
          comment: "인생 영화입니다.",
          createdAt: "2026-11-25T21:00:00.000Z",
          updatedAt: "2026-11-25T21:00:00.000Z",
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "입력값 검증 실패 (COMMON400)",
  })
  @ApiResponse({
    status: 401,
    description: "토큰이 없거나 유효하지 않음 (AUTH401_2 / AUTH401_3)",
  })
  @ApiResponse({
    status: 409,
    description: "이미 평점을 남긴 영화 (RATING409_1)",
    schema: {
      example: {
        isSuccess: false,
        code: "RATING409_1",
        message: "이미 이 영화에 평점을 남기셨습니다.",
        result: null,
      },
    },
  })
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

  @ApiBearerAuth("bearerAuth")
  @ApiOperation({
    summary: "평점 수정",
    description:
      "본인이 작성한 평점의 점수나 한줄평을 수정합니다. 보낸 필드만 덮어씁니다. 토큰이 필요합니다.",
  })
  @ApiParam({ name: "ratingId", description: "수정할 평점의 ID", example: 1 })
  @ApiResponse({
    status: 200,
    description: "평점 수정 성공",
    schema: {
      example: {
        isSuccess: true,
        code: "COMMON200",
        message: "평점을 수정했습니다.",
        result: {
          ratingId: 1,
          movieId: 550,
          score: 5,
          comment: "다시 보니 더 좋네요.",
          createdAt: "2026-11-25T21:00:00.000Z",
          updatedAt: "2026-11-25T21:30:00.000Z",
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "수정할 내용이 없거나 검증 실패 (COMMON400)",
  })
  @ApiResponse({
    status: 401,
    description: "토큰이 없거나 유효하지 않음 (AUTH401_2 / AUTH401_3)",
  })
  @ApiResponse({
    status: 403,
    description: "남이 작성한 평점 (RATING403_1)",
    schema: {
      example: {
        isSuccess: false,
        code: "RATING403_1",
        message: "본인이 작성한 평점만 수정하거나 삭제할 수 있습니다.",
        result: null,
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: "해당 평점이 존재하지 않음 (RATING404_1)",
  })
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

  @ApiBearerAuth("bearerAuth")
  @ApiOperation({
    summary: "평점 삭제",
    description:
      "본인이 작성한 평점을 삭제합니다. 공통 응답 형식을 싣기 위해 204가 아닌 200과 result: null을 돌려줍니다. 토큰이 필요합니다.",
  })
  @ApiParam({ name: "ratingId", description: "삭제할 평점의 ID", example: 1 })
  @ApiResponse({
    status: 200,
    description: "평점 삭제 성공",
    schema: {
      example: {
        isSuccess: true,
        code: "COMMON200",
        message: "평점을 삭제했습니다.",
        result: null,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "토큰이 없거나 유효하지 않음 (AUTH401_2 / AUTH401_3)",
  })
  @ApiResponse({
    status: 403,
    description: "남이 작성한 평점 (RATING403_1)",
  })
  @ApiResponse({
    status: 404,
    description: "해당 평점이 존재하지 않음 (RATING404_1)",
  })
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