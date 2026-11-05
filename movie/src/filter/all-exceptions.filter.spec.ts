import {
  ArgumentsHost,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import {
  ApiException,
  ErrorCode,
  memberNotFound,
} from '../exception/api.exception.js';
import {
  AllExceptionsFilter,
  toDuplicateException,
} from './all-exceptions.filter.js';

/** 필터가 response.status(...).json(...) 으로 내보낸 값을 잡아 둔다. */
function run(exception: unknown) {
  const json = vi.fn();
  const status = vi.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as unknown as ArgumentsHost;
  new AllExceptionsFilter().catch(exception, host);
  return {
    status: (status.mock.calls[0] as unknown as [number])[0],
    body: json.mock.calls[0][0] as Record<string, unknown>,
  };
}

/** mysql2 가 UNIQUE 위반 때 던지는 오류를 TypeORM 이 감싼 모양을 흉내 낸다. */
function duplicateEntry(key: string) {
  const driverError = Object.assign(
    new Error(`Duplicate entry 'x' for key '${key}'`),
    {
      code: 'ER_DUP_ENTRY',
      sqlMessage: `Duplicate entry 'x' for key '${key}'`,
    },
  );
  return new QueryFailedError('INSERT ...', [], driverError);
}

describe('AllExceptionsFilter', () => {
  // 서버 로그(warn)는 남기되 테스트 출력은 조용히 둔다.
  const warned = vi.spyOn(Logger.prototype, 'warn');
  beforeEach(() => warned.mockClear().mockImplementation(() => undefined));
  afterAll(() => warned.mockRestore());

  it('DB UNIQUE 위반을 바꿀 때 key 이름만 경고 로그로 남기고 값은 남기지 않는다', () => {
    run(duplicateEntry('member.email'));
    expect(warned).toHaveBeenCalledTimes(1);
    expect(String(warned.mock.calls[0][0])).toContain('member.email');
    expect(String(warned.mock.calls[0][0])).not.toContain("'x'");
  });

  it('ApiException 은 상태·code·message 를 그대로 쓴다', () => {
    const { status, body } = run(memberNotFound());
    expect(status).toBe(404);
    expect(body).toEqual({
      isSuccess: false,
      code: 'MEMBER4041',
      message: '존재하지 않는 유저입니다.',
      result: null,
    });
  });

  it('ValidationPipe 의 message 배열은 첫 번째 이유만, code 는 COMMON400', () => {
    const { status, body } = run(
      new BadRequestException({
        message: [
          '올바른 이메일 형식이 아닙니다.',
          '닉네임은 2자 이상이어야 합니다.',
        ],
        error: 'Bad Request',
        statusCode: 400,
      }),
    );
    expect(status).toBe(400);
    expect(body).toEqual({
      isSuccess: false,
      code: 'COMMON400',
      message: '올바른 이메일 형식이 아닙니다.',
      result: null,
    });
  });

  it('없는 경로 같은 일반 HttpException 은 COMMON + 상태 코드', () => {
    const { status, body } = run(new NotFoundException('Cannot GET /nope'));
    expect(status).toBe(404);
    expect(body.code).toBe('COMMON404');
    expect(body.isSuccess).toBe(false);
  });

  it('DB UNIQUE 위반(email) → 409 MEMBER4091, 같은 응답 틀', () => {
    const { status, body } = run(duplicateEntry('member.email'));
    expect(status).toBe(409);
    expect(body).toEqual({
      isSuccess: false,
      code: 'MEMBER4091',
      message: '이미 사용 중인 이메일입니다.',
      result: null,
    });
  });

  it('DB UNIQUE 위반(nickname) → 409 MEMBER4092, 평점 UNIQUE → RATING4091', () => {
    expect(run(duplicateEntry('member.nickname')).body.code).toBe('MEMBER4092');
    expect(run(duplicateEntry('rating.uk_rating_member_movie')).body.code).toBe(
      'RATING4091',
    );
  });

  it('어느 UNIQUE 인지 모르면 일반 409 COMMON409', () => {
    const { status, body } = run(duplicateEntry('member.IDX_abc123'));
    expect(status).toBe(409);
    expect(body.code).toBe(ErrorCode.CONFLICT);
  });

  it('처음 보는 오류는 500 과 고정 문구만 보여주고 내부 메시지는 숨긴다', () => {
    // 서버 로그에는 원문을 남기지만 테스트 출력은 조용히 둔다.
    const logged = vi
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const { status, body } = run(
      new Error("Access denied for user 'root'@'localhost'"),
    );
    expect(status).toBe(500);
    expect(body.code).toBe('COMMON500');
    expect(JSON.stringify(body)).not.toContain('Access denied');
    expect(logged).toHaveBeenCalledTimes(1);
    logged.mockRestore();
  });
});

describe('toDuplicateException', () => {
  it('UNIQUE 위반이 아니면 null', () => {
    expect(toDuplicateException(new Error('boom'))).toBeNull();
    expect(toDuplicateException(undefined)).toBeNull();
  });

  it('결과는 ApiException', () => {
    expect(toDuplicateException(duplicateEntry('email'))).toBeInstanceOf(
      ApiException,
    );
  });
});
