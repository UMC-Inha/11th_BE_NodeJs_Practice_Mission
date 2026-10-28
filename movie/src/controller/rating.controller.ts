import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { RatingPageQueryDto } from '../dto/member-request.dto.js';
import { RatingResponseDto } from '../dto/rating-response.dto.js';
import { RatingService } from '../service/rating.service.js';

/**
 * 파일은 담당 자원(Rating) 기준으로 나누고,
 * URL은 프론트가 읽기 쉬운 "회원의 평점" 모양(/members/...)으로 맞춘다.
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
}
