import type { Request } from 'express';

/**
 * AuthGuard 가 토큰에서 꺼낸 회원 번호를 요청 객체에 담아 두는 이름.
 * 이 문자열을 Guard 와 @LoginMember 가 각자 적으면 한쪽만 바꿨을 때 조용히 깨지므로 한곳에 둔다.
 */
export const LOGIN_MEMBER_KEY = 'memberId';

export type AuthenticatedRequest = Request & { [LOGIN_MEMBER_KEY]?: number };

/** 토큰(JWT)의 payload. sub 는 JWT 표준에서 "이 토큰의 주인"을 뜻한다. */
export interface AccessTokenPayload {
  sub: string;
  email: string;
}
