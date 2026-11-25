import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { CreateMovieRecordDto } from '../dto/create-movie-record.dto.js';
import { ApiException } from '../exception/api.exception.js';
import { AuthGuard } from '../guard/auth.guard.js';
import { MovieRecordService } from '../service/movie-record.service.js';

@Controller('movie-records')
@UseGuards(AuthGuard)
export class MovieRecordController {
  constructor(private readonly movieRecordService: MovieRecordService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() request: Request & { memberId?: number },
    @Body() dto: CreateMovieRecordDto,
  ) {
    const memberId = request.memberId;
    if (memberId === undefined || !Number.isSafeInteger(memberId) || memberId < 1) {
      throw new ApiException(
        HttpStatus.UNAUTHORIZED,
        'AUTH401_3',
        '유효하지 않은 토큰입니다.',
      );
    }

    return {
      isSuccess: true,
      code: 'COMMON201',
      message: '영화 기록을 저장했습니다.',
      result: await this.movieRecordService.create(memberId, dto),
    };
  }
}
