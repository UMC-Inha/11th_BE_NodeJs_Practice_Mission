import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { LoginMember } from '../decorator/login-member.decorator.js';
import { ApiResponse } from '../dto/api-response.dto.js';
import { CreateMovieRecordDto } from '../dto/create-movie-record.dto.js';
import { MovieRecordResponseDto } from '../dto/movie-record-response.dto.js';
import {
  favoriteDuplicated,
  ratingDuplicated,
} from '../exception/api.exception.js';
import { AuthGuard } from '../guard/auth.guard.js';
import { MovieRecordService } from '../service/movie-record.service.js';
import {
  ApiAuthFailures,
  ApiFailure,
  ApiMemberNotFound,
  ApiSuccess,
  failureBody,
  validationFailureBody,
} from '../swagger/api-docs.js';

/**
 * 평점과 즐겨찾기를 함께 저장하는 학습용 API. 프론트 화면에서 반드시 바로 쓰는 API 라기보다,
 * 한 요청에 저장 작업이 여러 개일 때 트랜잭션을 어떻게 설계하는지 보여 주려는 것이다.
 */
@ApiTags('영화 기록')
@ApiBearerAuth()
@Controller('movie-records')
@UseGuards(AuthGuard)
export class MovieRecordController {
  constructor(private readonly movieRecordService: MovieRecordService) {}

  // POST /movie-records → 201 { rating, favorite }
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '영화 기록 저장 — 평점 + 즐겨찾기를 한 트랜잭션으로 (토큰 필요)',
    description:
      'addToFavorites 가 true 면 평점과 즐겨찾기를 같은 트랜잭션에서 저장한다. 둘 중 하나라도 실패하면 먼저 저장한 것도 취소(rollback)된다. false 면 평점만 저장하고 favorite 은 null 이다.',
  })
  @ApiBody({
    type: CreateMovieRecordDto,
    examples: {
      '평점 + 즐겨찾기': {
        value: {
          movieId: 238,
          score: 5,
          comment: '다시 보고 싶은 영화입니다.',
          addToFavorites: true,
        },
      },
      평점만: {
        value: { movieId: 155, score: 4, addToFavorites: false },
      },
    },
  })
  @ApiSuccess(
    201,
    '영화 기록을 저장했다',
    'COMMON201',
    '영화 기록을 저장했습니다.',
    {
      rating: {
        ratingId: 3,
        movieId: 238,
        score: 5,
        comment: '다시 보고 싶은 영화입니다.',
        createdAt: '2026-11-18T05:10:00.000Z',
        updatedAt: '2026-11-18T05:10:00.000Z',
      },
      favorite: {
        favoriteId: 2,
        movieId: 238,
        createdAt: '2026-11-18T05:10:00.000Z',
      },
    },
  )
  @ApiFailure(
    400,
    '입력 규칙을 통과하지 못함 (영화 ID, 별점 1~5, addToFavorites)',
    {
      COMMON400: validationFailureBody('별점은 5점 이하여야 합니다.'),
    },
  )
  @ApiAuthFailures()
  @ApiMemberNotFound()
  @ApiFailure(
    409,
    '이미 평점을 남겼거나(RATING409_1), 즐겨찾기를 했음(FAVORITE409_1) — 어느 쪽이든 아무것도 저장되지 않는다',
    {
      [ratingDuplicated().code]: failureBody(ratingDuplicated()),
      [favoriteDuplicated().code]: failureBody(favoriteDuplicated()),
    },
  )
  async create(
    @LoginMember() memberId: number,
    @Body() dto: CreateMovieRecordDto,
  ): Promise<ApiResponse<MovieRecordResponseDto>> {
    const result = await this.movieRecordService.create(memberId, dto);
    return ApiResponse.success(
      'COMMON201',
      '영화 기록을 저장했습니다.',
      result,
    );
  }
}
