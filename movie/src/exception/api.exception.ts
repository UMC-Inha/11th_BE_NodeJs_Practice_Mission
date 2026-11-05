import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 화면이 보고 분기할 수 있는 오류 코드 목록.
 * 도메인 + HTTP 상태 + 순번 (예: MEMBER4091 = 회원 도메인의 409 첫 번째 사유).
 * 같은 409라도 이메일 중복과 닉네임 중복은 code 로 구분한다.
 */
export const ErrorCode = {
  VALIDATION_FAILED: 'COMMON400',
  NOT_FOUND: 'COMMON404',
  CONFLICT: 'COMMON409',
  INTERNAL: 'COMMON500',
  MEMBER_NOT_FOUND: 'MEMBER4041',
  EMAIL_DUPLICATED: 'MEMBER4091',
  NICKNAME_DUPLICATED: 'MEMBER4092',
  RATING_NOT_FOUND: 'RATING4041',
  RATING_FORBIDDEN: 'RATING4031',
  RATING_DUPLICATED: 'RATING4091',
} as const;

/** 우리가 의도해서 던지는 오류. HTTP 상태와 함께 응답 틀의 code 를 들고 다닌다. */
export class ApiException extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: string,
    message: string,
  ) {
    super(message, status);
  }
}

export const memberNotFound = () =>
  new ApiException(
    HttpStatus.NOT_FOUND,
    ErrorCode.MEMBER_NOT_FOUND,
    '존재하지 않는 유저입니다.',
  );

export const emailDuplicated = () =>
  new ApiException(
    HttpStatus.CONFLICT,
    ErrorCode.EMAIL_DUPLICATED,
    '이미 사용 중인 이메일입니다.',
  );

export const nicknameDuplicated = () =>
  new ApiException(
    HttpStatus.CONFLICT,
    ErrorCode.NICKNAME_DUPLICATED,
    '이미 사용 중인 닉네임입니다.',
  );

export const ratingNotFound = () =>
  new ApiException(
    HttpStatus.NOT_FOUND,
    ErrorCode.RATING_NOT_FOUND,
    '존재하지 않는 평점입니다.',
  );

export const ratingForbidden = () =>
  new ApiException(
    HttpStatus.FORBIDDEN,
    ErrorCode.RATING_FORBIDDEN,
    '본인이 작성한 평점만 수정하거나 삭제할 수 있습니다.',
  );

export const ratingDuplicated = () =>
  new ApiException(
    HttpStatus.CONFLICT,
    ErrorCode.RATING_DUPLICATED,
    '이미 이 영화에 평점을 남기셨습니다.',
  );
