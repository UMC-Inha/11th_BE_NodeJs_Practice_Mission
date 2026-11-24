import { ApiResponse as ApiResponseDoc } from '@nestjs/swagger';
import {
  ApiException,
  emailDuplicated,
  favoriteDuplicated,
  memberNotFound,
  nicknameDuplicated,
  ratingDuplicated,
  ratingForbidden,
  ratingNotFound,
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

/**
 * 5주차 조회 API(유저별 평점 목록, 닉네임·이메일 중복 확인)는 성공 본문을 공통 틀로 감싸지 않고
 * 값을 그대로 돌려준다(프론트가 이미 그 모양에 맞춰 만들어져 있다). 그래서 성공 예시도 감싸지 않는다.
 * 실패는 7주차부터 모든 API 가 같은 틀({ isSuccess, code, message, result })이다.
 */
export function ApiRawSuccess(
  status: number,
  description: string,
  example: unknown,
) {
  return ApiResponseDoc({
    status,
    description,
    content: { 'application/json': { example } },
  });
}

export const ApiRatingNotFound = () =>
  ApiFailure(
    404,
    '해당 평점이 없음 (403 이 아니라 404 — 없는 것에는 주인이 없다)',
    { [ratingNotFound().code]: failureBody(ratingNotFound()) },
  );

export const ApiRatingForbidden = () =>
  ApiFailure(403, '다른 회원의 평점은 수정하거나 지울 수 없음', {
    [ratingForbidden().code]: failureBody(ratingForbidden()),
  });

export const ApiRatingDuplicated = () =>
  ApiFailure(
    409,
    '이미 이 영화에 평점을 남김 (회원 한 명당 영화 하나에 평점 하나)',
    { [ratingDuplicated().code]: failureBody(ratingDuplicated()) },
  );

export const ApiNicknameDuplicated = () =>
  ApiFailure(409, '이미 사용 중인 닉네임', {
    [nicknameDuplicated().code]: failureBody(nicknameDuplicated()),
  });

/** 회원가입의 409 는 이메일 중복과 닉네임 중복을 code 로 구분한다. */
export const ApiSignUpDuplicated = () =>
  ApiFailure(409, '이미 사용 중인 이메일 또는 닉네임', {
    [emailDuplicated().code]: failureBody(emailDuplicated()),
    [nicknameDuplicated().code]: failureBody(nicknameDuplicated()),
  });
