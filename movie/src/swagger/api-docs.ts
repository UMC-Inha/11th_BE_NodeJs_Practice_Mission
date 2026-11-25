import { ApiResponse as ApiResponseDoc } from '@nestjs/swagger';
import {
  ApiException,
  favoriteDuplicated,
  memberNotFound,
  tokenExpired,
  tokenInvalid,
  tokenMissing,
} from '../exception/api.exception.js';

/**
 * Swagger 문서에 넣을 응답 예시를 만드는 도구.
 * 실패 예시의 code·message 는 코드에서 실제로 던지는 예외(factory)에서 꺼내므로, 문서와 동작이 어긋나지 않는다.
 */
export const successBody = (
  code: string,
  message: string,
  result: unknown,
) => ({ isSuccess: true, code, message, result });

export const failureBody = (exception: ApiException) => ({
  isSuccess: false,
  code: exception.code,
  message: exception.message,
  result: null,
});

export const validationFailureBody = (message: string) => ({
  isSuccess: false,
  code: 'COMMON400',
  message,
  result: null,
});

export function ApiSuccess(
  status: number,
  description: string,
  code: string,
  message: string,
  result: unknown,
) {
  return ApiResponseDoc({
    status,
    description,
    content: {
      'application/json': { example: successBody(code, message, result) },
    },
  });
}

/** 같은 상태 코드에 이유(code)가 여러 개면 예시를 code 별로 나란히 보여준다. */
export function ApiFailure(
  status: number,
  description: string,
  examples: Record<string, unknown>,
) {
  return ApiResponseDoc({
    status,
    description,
    content: {
      'application/json': {
        examples: Object.fromEntries(
          Object.entries(examples).map(([name, value]) => [
            name,
            { summary: name, value },
          ]),
        ),
      },
    },
  });
}

/** 토큰이 필요한 API 가 공통으로 낼 수 있는 401 세 가지. 상태는 같아도 code 가 다르다. */
export const ApiAuthFailures = () =>
  ApiFailure(401, '인증 실패 — 토큰 없음/위조/만료는 code 로 구분한다', {
    [tokenMissing().code]: failureBody(tokenMissing()),
    [tokenInvalid().code]: failureBody(tokenInvalid()),
    [tokenExpired().code]: failureBody(tokenExpired()),
  });

export const ApiMemberNotFound = () =>
  ApiFailure(404, '토큰의 회원을 찾을 수 없음', {
    [memberNotFound().code]: failureBody(memberNotFound()),
  });

export const ApiFavoriteDuplicated = () =>
  ApiFailure(409, '이미 즐겨찾기한 영화', {
    [favoriteDuplicated().code]: failureBody(favoriteDuplicated()),
  });
