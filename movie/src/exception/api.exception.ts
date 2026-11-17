import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 화면이 보고 분기할 수 있는 오류 코드 목록.
 *
 * 7주차부터 {도메인}{HTTP 상태}_{일련번호} 모양이다 (예: AUTH401_4 = 인증 도메인의 401 중 네 번째 사유).
 * 6주차의 MEMBER4091 처럼 상태와 순번을 붙여 쓰던 코드는 이 규칙으로 바꿨다 (README 의 대응표 참고).
 * 같은 401 이어도 로그인 실패·토큰 없음·위조·만료를 code 로 구분할 수 있어야 해서 일련번호가 필요하다.
 */
export const ErrorCode = {
  VALIDATION_FAILED: 'COMMON400',
  NOT_FOUND: 'COMMON404',
  CONFLICT: 'COMMON409',
  INTERNAL: 'COMMON500',
  LOGIN_FAILED: 'AUTH401_1',
  TOKEN_MISSING: 'AUTH401_2',
  TOKEN_INVALID: 'AUTH401_3',
  TOKEN_EXPIRED: 'AUTH401_4',
  MEMBER_NOT_FOUND: 'MEMBER404_1',
  NICKNAME_DUPLICATED: 'MEMBER409_1',
  // 워크북 표에는 없는 코드. 같은 409 라도 이메일 중복과 닉네임 중복을 구분하려고 6주차부터 따로 둔다.
  EMAIL_DUPLICATED: 'MEMBER409_2',
  RATING_NOT_FOUND: 'RATING404_1',
  RATING_FORBIDDEN: 'RATING403_1',
  RATING_DUPLICATED: 'RATING409_1',
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

/**
 * 로그인 실패. 이메일이 없어도, 비밀번호가 틀려도 이 응답 하나만 쓴다.
 * 둘을 나눠 알려 주면 이메일을 하나씩 넣어 보며 가입 여부를 알아낼 수 있다.
 */
export const loginFailed = () =>
  new ApiException(
    HttpStatus.UNAUTHORIZED,
    ErrorCode.LOGIN_FAILED,
    '이메일 또는 비밀번호가 올바르지 않습니다.',
  );

export const tokenMissing = () =>
  new ApiException(
    HttpStatus.UNAUTHORIZED,
    ErrorCode.TOKEN_MISSING,
    '로그인이 필요한 요청입니다.',
  );

export const tokenInvalid = () =>
  new ApiException(
    HttpStatus.UNAUTHORIZED,
    ErrorCode.TOKEN_INVALID,
    '유효하지 않은 토큰입니다.',
  );

export const tokenExpired = () =>
  new ApiException(
    HttpStatus.UNAUTHORIZED,
    ErrorCode.TOKEN_EXPIRED,
    '토큰이 만료되었습니다. 다시 로그인해주세요.',
  );

export const memberNotFound = () =>
  new ApiException(
    HttpStatus.NOT_FOUND,
    ErrorCode.MEMBER_NOT_FOUND,
    '해당 회원을 찾을 수 없습니다.',
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
    '해당 평점을 찾을 수 없습니다.',
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
