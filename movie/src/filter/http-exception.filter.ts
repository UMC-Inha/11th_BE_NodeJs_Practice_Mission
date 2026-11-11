import { ArgumentsHost, Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { ApiException } from '../exception/api.exception.js';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string | undefined;
    let message = '서버 오류가 발생했습니다.';
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (exception instanceof ApiException) {
        code = exception.code;
      } else if (typeof body === 'object' && 'code' in body && typeof body.code === 'string') {
        code = body.code;
      }
      const detail = typeof body === 'string' ? body : (body as {message?: string | string[]}).message;
      message = Array.isArray(detail) ? detail[0] : detail ?? exception.message;
    } else if (exception instanceof QueryFailedError && exception.driverError.code === 'ER_DUP_ENTRY') {
      status = HttpStatus.CONFLICT;
      message = '이미 등록된 이메일, 닉네임 또는 영화 평점입니다.';
      const key = String(exception.driverError.sqlMessage ?? '').match(/for key ['`]([^'`]+)['`]/i)?.[1].split('.').pop();
      if (/INSERT INTO .?member.?\s*\(/i.test(exception.query)) {
        if (key === 'email') { code = 'MEMBER4091'; message = '이미 사용 중인 이메일입니다.'; }
        if (key === 'nickname') { code = 'MEMBER4092'; message = '이미 사용 중인 닉네임입니다.'; }
      } else if (/INSERT INTO .?rating.?\s*\(/i.test(exception.query) && key === 'uk_rating_member_movie') {
        code = 'RATING409_1'; message = '이미 이 영화에 평점을 남기셨습니다.';
      }
    } else {
      this.logger.error('처리되지 않은 서버 오류가 발생했습니다.');
    }
    response.status(status).json({ isSuccess: false, code: code ?? 'COMMON' + status, message, result: null });
  }
}
