import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiResponse } from '../dto/api-response.dto.js';
import {
  ApiException,
  ErrorCode,
  emailDuplicated,
  nicknameDuplicated,
  ratingDuplicated,
} from '../exception/api.exception.js';

/** MySQL UNIQUE 제약 위반 오류 번호(ER_DUP_ENTRY) */
const MYSQL_DUP_ENTRY = 'ER_DUP_ENTRY';

/**
 * 어디서 어떤 오류가 나도 { isSuccess:false, code, message, result:null } 로 돌려준다.
 *
 * 1. ApiException        → 우리가 정한 상태·code·message 그대로
 * 2. DB UNIQUE 위반       → 사전 중복 체크를 통과한 뒤에 생긴 경쟁 상황. 409 로 바꾼다.
 * 3. 그 밖의 HttpException → ValidationPipe(400), 없는 경로(404) 등. code 는 COMMON + 상태
 * 4. 처음 보는 오류        → 서버 로그에만 남기고, 화면에는 500 과 고정 문구만 준다.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const { status, code, message } = this.resolve(exception);
    response.status(status).json(ApiResponse.fail(code, message));
  }

  private resolve(exception: unknown) {
    if (isDuplicateEntryError(exception)) {
      // 사전 중복 체크를 통과한 뒤 DB 가 막은 경우. 값(이메일 등)은 남기지 않고 key 이름만 기록한다.
      this.logger.warn(
        `DB UNIQUE 제약 위반을 409 로 변환했습니다 (key: ${duplicateKeyOf(exception)})`,
      );
    }
    const duplicate = toDuplicateException(exception);
    const known = duplicate ?? exception;

    if (known instanceof ApiException) {
      return {
        status: known.getStatus(),
        code: known.code,
        message: known.message,
      };
    }

    if (known instanceof HttpException) {
      const status = known.getStatus();
      return { status, code: `COMMON${status}`, message: pickMessage(known) };
    }

    if (isDuplicateEntryError(exception)) {
      // 어느 UNIQUE 인지 몰라도 "이미 있다"는 사실은 확실하다.
      return {
        status: HttpStatus.CONFLICT,
        code: ErrorCode.CONFLICT,
        message: '이미 존재하는 데이터입니다.',
      };
    }

    this.logger.error(
      exception instanceof Error ? exception.stack : String(exception),
    );
    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL,
      message: '서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    };
  }
}

/** ValidationPipe 는 message 를 문자열 배열로 준다. 화면에는 첫 번째 이유 하나만 보여준다. */
function pickMessage(exception: HttpException): string {
  const body = exception.getResponse();
  const message =
    typeof body === 'string' ? body : (body as { message?: unknown }).message;
  if (Array.isArray(message)) return String(message[0]);
  return typeof message === 'string' ? message : exception.message;
}

type DriverError = { code?: string; sqlMessage?: string; message?: string };

function driverErrorOf(exception: unknown): DriverError | null {
  if (typeof exception !== 'object' || exception === null) return null;
  // TypeORM QueryFailedError 는 mysql2 오류를 driverError 에 담아 둔다.
  const wrapped = (exception as { driverError?: DriverError }).driverError;
  return wrapped ?? (exception as DriverError);
}

export function isDuplicateEntryError(exception: unknown): boolean {
  return driverErrorOf(exception)?.code === MYSQL_DUP_ENTRY;
}

/** "Duplicate entry 'a@b.com' for key 'member.email'" 에서 key 이름(member.email)만 꺼낸다. */
function duplicateKeyOf(exception: unknown): string {
  const driverError = driverErrorOf(exception);
  const text = driverError?.sqlMessage ?? driverError?.message ?? '';
  return /for key '([^']+)'/.exec(text)?.[1] ?? 'unknown';
}

/**
 * UNIQUE key 이름으로 이메일 / 닉네임 / 평점 중복을 구분한다. 알 수 없는 key 면 null.
 */
export function toDuplicateException(exception: unknown): ApiException | null {
  if (!isDuplicateEntryError(exception)) return null;
  const key = duplicateKeyOf(exception);

  if (key.endsWith('uk_rating_member_movie')) return ratingDuplicated();
  if (key === 'member.email' || key === 'email') return emailDuplicated();
  if (key === 'member.nickname' || key === 'nickname') {
    return nicknameDuplicated();
  }
  return null;
}
