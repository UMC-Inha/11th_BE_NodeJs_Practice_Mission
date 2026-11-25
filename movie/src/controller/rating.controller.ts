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
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { LoginMember } from '../decorator/login-member.decorator.js';
import { ApiResponse } from '../dto/api-response.dto.js';
import { CreateRatingDto } from '../dto/create-rating.dto.js';
import { RatingPageQueryDto } from '../dto/member-request.dto.js';
import { RatingResponseDto } from '../dto/rating-response.dto.js';
import { UpdateRatingDto } from '../dto/update-rating.dto.js';
import { AuthGuard } from '../guard/auth.guard.js';
import { RatingService } from '../service/rating.service.js';
import {
  ApiAuthFailures,
  ApiFailure,
  ApiMemberNotFound,
  ApiRatingDuplicated,
  ApiRatingForbidden,
  ApiRatingNotFound,
  ApiRawSuccess,
  ApiSuccess,
  validationFailureBody,
} from '../swagger/api-docs.js';

const SAMPLE_RATING = {
  ratingId: 3,
  movieId: 238,
  score: 5,
  comment: '다시 보고 싶은 영화입니다.',
  createdAt: '2026-11-18T05:00:00.000Z',
  updatedAt: '2026-11-18T05:00:00.000Z',
};

/**
 * 파일은 담당 자원(Rating) 기준으로 나눈다.
 * 7주차부터 쓰기 API 의 URL 에서 /members/{memberId} 가 사라지고, "누구"는 토큰이 알려 준다.
 * 값을 받지 않는 것이 곧 그 값을 조작당하지 않는 방법이다.
 */
@ApiTags('평점')
@Controller()
export class RatingController {
  constructor(private readonly ratingService: RatingService) {}

  // GET /members/{memberId}/ratings?page=0&size=10
  // 5주차에 만든 "특정 회원의 평점 목록"이다. 누구나 볼 수 있는 공개 API 라 AuthGuard 를 붙이지 않는다.
  @Get('members/:memberId/ratings')
  @ApiOperation({
    summary: '유저별 평점 조회 (공개 — 토큰 필요 없음)',
    description:
      '특정 회원이 남긴 평점 목록을 최신순으로 돌려준다. 공개 API 라 토큰이 필요 없다. ' +
      '5주차 명세 그대로 응답을 공통 틀로 감싸지 않고 배열만 돌려준다. ' +
      'page·size 를 모두 생략하면 전체, 하나라도 보내면 page 기본 0·size 기본 10 으로 잘라 준다.',
  })
  @ApiParam({ name: 'memberId', example: 1, description: '조회할 회원 ID' })
  @ApiRawSuccess(200, '그 회원의 평점 목록 (없으면 빈 배열)', [SAMPLE_RATING])
  @ApiFailure(
    400,
    'memberId 가 숫자가 아니거나 page·size 규칙을 통과하지 못함',
    {
      'size 범위 오류': validationFailureBody(
        'size는 1~50 사이 정수여야 합니다.',
      ),
    },
  )
  @ApiMemberNotFound()
  getMemberRatings(
    @Param('memberId', ParseIntPipe) memberId: number,
    @Query() query: RatingPageQueryDto,
  ): Promise<RatingResponseDto[]> {
    return this.ratingService.getRatingsByMember(memberId, query);
  }

  // POST /ratings → 201, result 는 방금 만든 평점
  @Post('ratings')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '평점 등록 (토큰 필요)',
    description:
      '로그인한 회원이 TMDB 영화에 별점(1~5)과 후기(선택, 500자 이하)를 남긴다. ' +
      '작성자는 Body 가 아니라 토큰이 정한다(memberId 를 보내면 400). ' +
      '같은 영화에 두 번 남기면 409 RATING409_1.',
  })
  @ApiBody({
    type: CreateRatingDto,
    examples: {
      '별점 + 후기': {
        value: {
          movieId: 238,
          score: 5,
          comment: '다시 보고 싶은 영화입니다.',
        },
      },
      별점만: { value: { movieId: 238, score: 4 } },
    },
  })
  @ApiSuccess(
    201,
    '평점을 등록했다 (result 는 만들어진 평점)',
    'COMMON201',
    '평점 등록에 성공했습니다.',
    SAMPLE_RATING,
  )
  @ApiFailure(400, '입력 규칙을 통과하지 못함 (저장되지 않는다)', {
    '별점 범위 오류': validationFailureBody('별점은 5점 이하여야 합니다.'),
    '영화 ID 오류': validationFailureBody('영화 ID는 양수여야 합니다.'),
    'memberId 를 몰래 보냄': validationFailureBody(
      'property memberId should not exist',
    ),
  })
  @ApiAuthFailures()
  @ApiMemberNotFound()
  @ApiRatingDuplicated()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @LoginMember() memberId: number,
    @Body() dto: CreateRatingDto,
  ): Promise<ApiResponse<RatingResponseDto>> {
    const result = await this.ratingService.create(memberId, dto);
    return ApiResponse.success(
      'COMMON201',
      '평점 등록에 성공했습니다.',
      result,
    );
  }

  // PATCH /ratings/{ratingId} → 200, result 는 수정된 평점
  @Patch('ratings/:ratingId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '평점 수정 (토큰 필요, 내 평점만)',
    description:
      '내가 남긴 평점의 별점과 후기를 바꾼다. movieId 는 바꿀 수 없다. ' +
      'comment 를 생략하면 기존 후기를 유지하고, null 을 보내면 후기를 지운다. ' +
      '없는 평점은 404, 다른 회원의 평점은 403 이다.',
  })
  @ApiParam({ name: 'ratingId', example: 3, description: '수정할 평점 ID' })
  @ApiBody({
    type: UpdateRatingDto,
    examples: {
      '별점과 후기 수정': {
        value: { score: 4, comment: '두 번째 보니 더 좋았습니다.' },
      },
      '후기 지우기': { value: { score: 4, comment: null } },
    },
  })
  @ApiSuccess(
    200,
    '평점을 수정했다 (result 는 수정된 평점)',
    'COMMON200',
    '평점 수정에 성공했습니다.',
    { ...SAMPLE_RATING, score: 4, comment: '두 번째 보니 더 좋았습니다.' },
  )
  @ApiFailure(400, '입력 규칙을 통과하지 못하거나 ratingId 가 숫자가 아님', {
    '별점 범위 오류': validationFailureBody('별점은 1점 이상이어야 합니다.'),
  })
  @ApiAuthFailures()
  @ApiRatingForbidden()
  @ApiRatingNotFound()
  async update(
    @LoginMember() memberId: number,
    @Param('ratingId', ParseIntPipe) ratingId: number,
    @Body() dto: UpdateRatingDto,
  ): Promise<ApiResponse<RatingResponseDto>> {
    const result = await this.ratingService.update(memberId, ratingId, dto);
    return ApiResponse.success(
      'COMMON200',
      '평점 수정에 성공했습니다.',
      result,
    );
  }

  // DELETE /ratings/{ratingId} → 200 (result null)
  // 6주차에는 204 였다. 204 는 본문을 보내지 않겠다는 뜻이라 { isSuccess, code, message, result } 를 실을 수 없다.
  // 삭제만 응답 틀에서 빠지는 것을 막으려고 200 + result null 로 맞춘다.
  @Delete('ratings/:ratingId')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '평점 삭제 (토큰 필요, 내 평점만)',
    description:
      '내가 남긴 평점을 지운다. 6주차의 204 와 달리 200 과 공통 응답 틀(result: null)이다. ' +
      '없는 평점은 404, 다른 회원의 평점은 403 이다.',
  })
  @ApiParam({ name: 'ratingId', example: 3, description: '삭제할 평점 ID' })
  @ApiSuccess(
    200,
    '평점을 삭제했다 (result 는 null)',
    'COMMON200',
    '평점 삭제에 성공했습니다.',
    null,
  )
  @ApiFailure(400, 'ratingId 가 숫자가 아님', {
    'ratingId 형식 오류': validationFailureBody(
      'Validation failed (numeric string is expected)',
    ),
  })
  @ApiAuthFailures()
  @ApiRatingForbidden()
  @ApiRatingNotFound()
  async delete(
    @LoginMember() memberId: number,
    @Param('ratingId', ParseIntPipe) ratingId: number,
  ): Promise<ApiResponse<null>> {
    await this.ratingService.delete(memberId, ratingId);
    return ApiResponse.success('COMMON200', '평점 삭제에 성공했습니다.', null);
  }
}
