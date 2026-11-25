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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LoginMember } from '../decorator/login-member.decorator.js';
import { ApiResponse } from '../dto/api-response.dto.js';
import { CreateFavoriteDto } from '../dto/create-favorite.dto.js';
import { FavoriteResponseDto } from '../dto/favorite-response.dto.js';
import { FavoriteStatusResponseDto } from '../dto/favorite-status-response.dto.js';
import { favoriteNotFound } from '../exception/api.exception.js';
import { AuthGuard } from '../guard/auth.guard.js';
import { FavoriteService } from '../service/favorite.service.js';
import {
  ApiAuthFailures,
  ApiFailure,
  ApiFavoriteDuplicated,
  ApiMemberNotFound,
  ApiSuccess,
  failureBody,
  validationFailureBody,
} from '../swagger/api-docs.js';

const SAMPLE_FAVORITE = {
  favoriteId: 1,
  movieId: 550,
  createdAt: '2026-11-18T05:00:00.000Z',
};

/**
 * 즐겨찾기는 로그인한 회원의 데이터라 컨트롤러 전체에 AuthGuard 를 건다.
 * 누구의 즐겨찾기인지는 URL·Body·Query 가 아니라 토큰이 알려 주므로 memberId 를 받는 곳이 없다.
 */
@ApiTags('즐겨찾기')
@ApiBearerAuth()
@Controller('favorites')
@UseGuards(AuthGuard)
export class FavoriteController {
  constructor(private readonly favoriteService: FavoriteService) {}

  // POST /favorites { movieId } → 201
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '즐겨찾기 등록 (토큰 필요)',
    description:
      '로그인한 회원이 TMDB 영화 ID 를 즐겨찾기한다. 같은 영화를 두 번 등록하면 409 FAVORITE409_1.',
  })
  @ApiBody({
    type: CreateFavoriteDto,
    examples: { 기본: { value: { movieId: 550 } } },
  })
  @ApiSuccess(
    201,
    '즐겨찾기를 등록했다',
    'COMMON201',
    '즐겨찾기를 등록했습니다.',
    SAMPLE_FAVORITE,
  )
  @ApiFailure(400, '영화 ID 입력 규칙을 통과하지 못함 (예: 0, 문자열)', {
    COMMON400: validationFailureBody('영화 ID는 양수여야 합니다.'),
  })
  @ApiAuthFailures()
  @ApiMemberNotFound()
  @ApiFavoriteDuplicated()
  async create(
    @LoginMember() memberId: number,
    @Body() dto: CreateFavoriteDto,
  ): Promise<ApiResponse<FavoriteResponseDto>> {
    const result = await this.favoriteService.create(memberId, dto);
    return ApiResponse.success('COMMON201', '즐겨찾기를 등록했습니다.', result);
  }

  // GET /favorites → 200, 내 것만 최신 등록 순. 비어 있어도 200 []
  @Get()
  @ApiOperation({
    summary: '내 즐겨찾기 목록 조회 (토큰 필요)',
    description:
      '내 즐겨찾기만 최근에 등록한 순서로 돌려준다. 보관한 영화가 없으면 오류가 아니라 200 과 빈 배열이다.',
  })
  @ApiSuccess(
    200,
    '내 즐겨찾기 목록 (없으면 빈 배열)',
    'COMMON200',
    '내 즐겨찾기 목록을 조회했습니다.',
    [SAMPLE_FAVORITE],
  )
  @ApiAuthFailures()
  async getMyFavorites(
    @LoginMember() memberId: number,
  ): Promise<ApiResponse<FavoriteResponseDto[]>> {
    const result = await this.favoriteService.getMyFavorites(memberId);
    return ApiResponse.success(
      'COMMON200',
      '내 즐겨찾기 목록을 조회했습니다.',
      result,
    );
  }

  // GET /favorites/{movieId} → 200 { isFavorite }
  @Get(':movieId')
  @ApiOperation({
    summary: '특정 영화 즐겨찾기 여부 조회 (토큰 필요)',
    description:
      '영화 상세 화면을 열 때 버튼을 채울지 결정하는 데 쓴다. 즐겨찾기하지 않았어도 오류가 아니라 200 과 isFavorite: false 다.',
  })
  @ApiSuccess(
    200,
    '즐겨찾기 여부',
    'COMMON200',
    '즐겨찾기 여부를 조회했습니다.',
    { isFavorite: true },
  )
  @ApiFailure(400, 'movieId 가 숫자가 아님', {
    COMMON400: validationFailureBody(
      'Validation failed (numeric string is expected)',
    ),
  })
  @ApiAuthFailures()
  async getStatus(
    @LoginMember() memberId: number,
    @Param('movieId', ParseIntPipe) movieId: number,
  ): Promise<ApiResponse<FavoriteStatusResponseDto>> {
    const result = await this.favoriteService.getStatus(memberId, movieId);
    return ApiResponse.success(
      'COMMON200',
      '즐겨찾기 여부를 조회했습니다.',
      result,
    );
  }

  // DELETE /favorites/{movieId} → 200 (result null). 204 가 아닌 이유는 평점 삭제와 같다.
  @Delete(':movieId')
  @ApiOperation({
    summary: '즐겨찾기 해제 (토큰 필요)',
    description:
      '성공해도 공통 응답 틀을 유지하려고 204 가 아니라 200 과 result: null 을 쓴다.',
  })
  @ApiSuccess(
    200,
    '즐겨찾기를 해제했다',
    'COMMON200',
    '즐겨찾기를 해제했습니다.',
    null,
  )
  // 9주차: 8주차에는 빠져 있던 400 (GET 과 같은 ParseIntPipe 가 같은 응답을 만든다)
  @ApiFailure(400, 'movieId 가 숫자가 아님', {
    COMMON400: validationFailureBody(
      'Validation failed (numeric string is expected)',
    ),
  })
  @ApiAuthFailures()
  @ApiFailure(404, '해제하려는 즐겨찾기를 찾을 수 없음', {
    [favoriteNotFound().code]: failureBody(favoriteNotFound()),
  })
  async delete(
    @LoginMember() memberId: number,
    @Param('movieId', ParseIntPipe) movieId: number,
  ): Promise<ApiResponse<null>> {
    await this.favoriteService.delete(memberId, movieId);
    return ApiResponse.success('COMMON200', '즐겨찾기를 해제했습니다.', null);
  }
}
