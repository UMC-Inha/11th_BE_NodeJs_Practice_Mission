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
import { LoginMember } from '../decorator/login-member.decorator.js';
import { ApiResponse } from '../dto/api-response.dto.js';
import { CreateRatingDto } from '../dto/create-rating.dto.js';
import { RatingPageQueryDto } from '../dto/member-request.dto.js';
import { RatingResponseDto } from '../dto/rating-response.dto.js';
import { UpdateRatingDto } from '../dto/update-rating.dto.js';
import { AuthGuard } from '../guard/auth.guard.js';
import { RatingService } from '../service/rating.service.js';

/**
 * 파일은 담당 자원(Rating) 기준으로 나눈다.
 * 7주차부터 쓰기 API 의 URL 에서 /members/{memberId} 가 사라지고, "누구"는 토큰이 알려 준다.
 * 값을 받지 않는 것이 곧 그 값을 조작당하지 않는 방법이다.
 */
@Controller()
export class RatingController {
  constructor(private readonly ratingService: RatingService) {}

  // GET /members/{memberId}/ratings?page=0&size=10
  // 5주차에 만든 "특정 회원의 평점 목록"이다. 누구나 볼 수 있는 공개 API 라 AuthGuard 를 붙이지 않는다.
  @Get('members/:memberId/ratings')
  getMemberRatings(
    @Param('memberId', ParseIntPipe) memberId: number,
    @Query() query: RatingPageQueryDto,
  ): Promise<RatingResponseDto[]> {
    return this.ratingService.getRatingsByMember(memberId, query);
  }

  // POST /ratings → 201, result 는 방금 만든 평점
  @Post('ratings')
  @UseGuards(AuthGuard)
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
  async delete(
    @LoginMember() memberId: number,
    @Param('ratingId', ParseIntPipe) ratingId: number,
  ): Promise<ApiResponse<null>> {
    await this.ratingService.delete(memberId, ratingId);
    return ApiResponse.success('COMMON200', '평점 삭제에 성공했습니다.', null);
  }
}
