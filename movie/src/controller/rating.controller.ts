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
} from '@nestjs/common';
import { ApiResponse } from '../dto/api-response.dto.js';
import { CreateRatingDto } from '../dto/create-rating.dto.js';
import { RatingPageQueryDto } from '../dto/member-request.dto.js';
import { RatingResponseDto } from '../dto/rating-response.dto.js';
import { UpdateRatingDto } from '../dto/update-rating.dto.js';
import { RatingService } from '../service/rating.service.js';

/**
 * 파일은 담당 자원(Rating) 기준으로 나누고,
 * URL은 프론트가 읽기 쉬운 "회원의 평점" 모양(/members/...)으로 맞춘다.
 *
 * 로그인(7주차) 전이라 요청한 회원을 경로의 memberId 로 구분한다.
 */
@Controller('members')
export class RatingController {
  constructor(private readonly ratingService: RatingService) {}

  // GET /members/{memberId}/ratings?page=0&size=10
  @Get(':memberId/ratings')
  getMemberRatings(
    @Param('memberId', ParseIntPipe) memberId: number,
    @Query() query: RatingPageQueryDto,
  ): Promise<RatingResponseDto[]> {
    return this.ratingService.getRatingsByMember(memberId, query);
  }

  // POST /members/{memberId}/ratings → 201, result 는 새 ratingId
  @Post(':memberId/ratings')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('memberId', ParseIntPipe) memberId: number,
    @Body() dto: CreateRatingDto,
  ): Promise<ApiResponse<number>> {
    const ratingId = await this.ratingService.create(memberId, dto);
    return ApiResponse.success(
      'COMMON201',
      '평점 등록에 성공했습니다.',
      ratingId,
    );
  }

  // PATCH /members/{memberId}/ratings/{ratingId} → 200
  @Patch(':memberId/ratings/:ratingId')
  async update(
    @Param('memberId', ParseIntPipe) memberId: number,
    @Param('ratingId', ParseIntPipe) ratingId: number,
    @Body() dto: UpdateRatingDto,
  ): Promise<ApiResponse<null>> {
    await this.ratingService.update(ratingId, memberId, dto);
    return ApiResponse.success('COMMON200', '평점 수정에 성공했습니다.', null);
  }

  // DELETE /members/{memberId}/ratings/{ratingId} → 204 (본문 없음)
  @Delete(':memberId/ratings/:ratingId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @Param('memberId', ParseIntPipe) memberId: number,
    @Param('ratingId', ParseIntPipe) ratingId: number,
  ): Promise<void> {
    await this.ratingService.delete(ratingId, memberId);
  }
}
