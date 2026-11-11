import { ArgumentsHost, Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { QueryFailedError } from 'typeorm';

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
      if (typeof body === 'object' && 'code' in body && typeof body.code === 'string') code = body.code;
      const detail = typeof body === 'string' ? body : (body as {message?: string | string[]}).message;
      message = Array.isArray(detail) ? detail[0] : detail ?? exception.message;
    } else if (exception instanceof QueryFailedError && exception.driverError.code === 'ER_DUP_ENTRY') {
      // 사전 중복 검사 후 동시에 들어온 요청도 DB UNIQUE 제약으로 보호합니다.
      status = HttpStatus.CONFLICT;
      message = '이미 등록된 이메일, 닉네임 또는 영화 평점입니다.';
      const key = String(exception.driverError.sqlMessage ?? '').match(/for key ['`]([^'`]+)['`]/i)?.[1].split('.').pop();
      if (/INSERT INTO .?member.?\s*\(/i.test(exception.query)) {
        if (key === 'email') { code = 'MEMBER4091'; message = '이미 사용 중인 이메일입니다.'; }
        if (key === 'nickname') { code = 'MEMBER4092'; message = '이미 사용 중인 닉네임입니다.'; }
      } else if (/INSERT INTO .?rating.?\s*\(/i.test(exception.query) && key === 'uk_rating_member_movie') {
        code = 'RATING4091'; message = '이미 이 영화에 평점을 남기셨습니다.';
      }
    } else {
      // QueryFailedError에는 비밀번호 등 SQL 파라미터가 포함될 수 있어 원문을 기록하지 않습니다.
      this.logger.error('처리되지 않은 서버 오류가 발생했습니다.');
    }
    response.status(status).json({ isSuccess: false, code: code ?? 'COMMON' + status, message, result: null });
  }
}
