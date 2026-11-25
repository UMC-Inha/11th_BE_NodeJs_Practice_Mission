import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
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
import { CreateFavoriteDto } from "../dto/create-favorite.dto";
import { AuthGuard } from "../guard/auth.guard";
import type { AuthenticatedRequest } from "../guard/auth.guard";
import { FavoriteService } from "../service/favorite.service";

@ApiTags("즐겨찾기")
@ApiBearerAuth("bearerAuth")
@Controller("favorites")
@UseGuards(AuthGuard)
export class FavoriteController {
  constructor(private readonly favoriteService: FavoriteService) {}

  @ApiOperation({
    summary: "즐겨찾기 등록",
    description:
      "토큰의 주인인 회원이 TMDB 영화 ID 하나를 즐겨찾기에 추가합니다.",
  })
  @ApiResponse({
    status: 201,
    description: "즐겨찾기 등록 성공",
    schema: {
      example: {
        isSuccess: true,
        code: "COMMON201",
        message: "즐겨찾기를 등록했습니다.",
        result: {
          favoriteId: 1,
          movieId: 550,
          createdAt: "2026-11-25T21:00:00.000Z",
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "토큰이 없거나 유효하지 않음",
    schema: {
      example: {
        isSuccess: false,
        code: "AUTH401_2",
        message: "로그인이 필요한 요청입니다.",
        result: null,
      },
    },
  })
  @ApiResponse({
    status: 409,
    description: "이미 즐겨찾기한 영화",
    schema: {
      example: {
        isSuccess: false,
        code: "FAVORITE409_1",
        message: "이미 이 영화를 즐겨찾기하셨습니다.",
        result: null,
      },
    },
  })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() request: AuthenticatedRequest,
    @Body() dto: CreateFavoriteDto,
  ) {
    const result = await this.favoriteService.create(request.memberId, dto);

    return {
      isSuccess: true,
      code: "COMMON201",
      message: "즐겨찾기를 등록했습니다.",
      result,
    };
  }

  @ApiOperation({
    summary: "내 즐겨찾기 조회",
    description:
      "토큰의 주인인 회원이 즐겨찾기한 영화 목록을 최신 등록순으로 조회합니다. 토큰이 필요합니다.",
  })
  @ApiResponse({
    status: 200,
    description: "조회 성공",
    schema: {
      example: {
        isSuccess: true,
        code: "COMMON200",
        message: "내 즐겨찾기 목록을 조회했습니다.",
        result: [
          {
            favoriteId: 2,
            movieId: 27205,
            createdAt: "2026-11-25T21:10:00.000Z",
          },
          {
            favoriteId: 1,
            movieId: 550,
            createdAt: "2026-11-25T21:00:00.000Z",
          },
        ],
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "토큰이 없거나 유효하지 않음 (AUTH401_2 / AUTH401_3)",
  })
  @Get()
  @HttpCode(HttpStatus.OK)
  async getMyFavorites(@Req() request: AuthenticatedRequest) {
    const result = await this.favoriteService.getMyFavorites(request.memberId);

    return {
      isSuccess: true,
      code: "COMMON200",
      message: "내 즐겨찾기 목록을 조회했습니다.",
      result,
    };
  }

  @ApiOperation({
    summary: "즐겨찾기 여부 조회",
    description:
      "영화 하나를 즐겨찾기했는지 확인합니다. 즐겨찾기하지 않은 영화도 오류가 아니라 200과 isFavorite: false를 돌려줍니다. 토큰이 필요합니다.",
  })
  @ApiParam({ name: "movieId", description: "TMDB 영화 ID", example: 550 })
  @ApiResponse({
    status: 200,
    description: "조회 성공",
    schema: {
      example: {
        isSuccess: true,
        code: "COMMON200",
        message: "즐겨찾기 여부를 조회했습니다.",
        result: { isFavorite: false },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "토큰이 없거나 유효하지 않음 (AUTH401_2 / AUTH401_3)",
  })
  @Get(":movieId")
  @HttpCode(HttpStatus.OK)
  async getStatus(
    @Req() request: AuthenticatedRequest,
    @Param("movieId", ParseIntPipe) movieId: number,
  ) {
    const result = await this.favoriteService.getStatus(
      request.memberId,
      movieId,
    );

    return {
      isSuccess: true,
      code: "COMMON200",
      message: "즐겨찾기 여부를 조회했습니다.",
      result,
    };
  }

  @ApiOperation({
    summary: "즐겨찾기 해제",
    description:
      "즐겨찾기를 해제합니다. 프론트가 아는 값이 movieId라서 favoriteId가 아닌 movieId로 찾습니다. 토큰이 필요합니다.",
  })
  @ApiParam({ name: "movieId", description: "TMDB 영화 ID", example: 550 })
  @ApiResponse({
    status: 200,
    description: "해제 성공",
    schema: {
      example: {
        isSuccess: true,
        code: "COMMON200",
        message: "즐겨찾기를 해제했습니다.",
        result: null,
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "토큰이 없거나 유효하지 않음 (AUTH401_2 / AUTH401_3)",
  })
  @ApiResponse({
    status: 404,
    description: "즐겨찾기하지 않은 영화 (FAVORITE404_1)",
  })
  @Delete(":movieId")
  @HttpCode(HttpStatus.OK)
  async delete(
    @Req() request: AuthenticatedRequest,
    @Param("movieId", ParseIntPipe) movieId: number,
  ) {
    await this.favoriteService.delete(request.memberId, movieId);

    return {
      isSuccess: true,
      code: "COMMON200",
      message: "즐겨찾기를 해제했습니다.",
      result: null,
    };
  }
}