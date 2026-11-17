import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { JwtService, TokenExpiredError } from '@nestjs/jwt';
import {
  tokenExpired,
  tokenInvalid,
  tokenMissing,
} from '../exception/api.exception.js';
import {
  AccessTokenPayload,
  AuthenticatedRequest,
  LOGIN_MEMBER_KEY,
} from './authenticated-request.js';

const BEARER_PREFIX = 'Bearer ';

/** "Bearer {토큰}" 에서 토큰만 꺼낸다. 형식이 아니거나 토큰이 비어 있으면 null. */
export function extractBearerToken(header: string | undefined): string | null {
  if (
    !header ||
    header.slice(0, BEARER_PREFIX.length).toLowerCase() !== 'bearer '
  ) {
    return null;
  }
  const token = header.slice(BEARER_PREFIX.length).trim();
  return token.length > 0 ? token : null;
}

/**
 * 컨트롤러가 실행되기 "전"에 요청자가 누구인지 확인하는 관문 (인증).
 * 통과하면 회원 번호를 요청에 담아 두고, 실패하면 여기서 끝난다.
 *
 *  - 토큰이 없음            → 401 AUTH401_2
 *  - 서명이 맞지 않음/깨짐   → 401 AUTH401_3  (위조·변조)
 *  - 유효시간이 지남         → 401 AUTH401_4  (다시 로그인하면 해결)
 *
 * "이 평점이 네 것이냐"는 여기서 보지 않는다. 그건 DB 를 봐야 아는 기능별 규칙이라 서비스가 확인한다(인가, 403).
 * 붙인 곳에만 적용된다: 로그인이 필요한 컨트롤러·메서드에 @UseGuards(AuthGuard) 를 빠뜨리지 않는다.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);
    if (token === null) {
      throw tokenMissing();
    }

    let payload: AccessTokenPayload;
    try {
      // 서명과 만료 시각을 함께 검증한다.
      payload = await this.jwtService.verifyAsync<AccessTokenPayload>(token);
    } catch (error) {
      if (error instanceof TokenExpiredError) {
        throw tokenExpired();
      }
      throw tokenInvalid();
    }

    // sub 는 문자열이다. 서명이 맞더라도 숫자 아닌 값이면 우리가 발급한 모양이 아니므로 거절한다.
    const memberId = Number(payload.sub);
    if (!Number.isSafeInteger(memberId) || memberId < 1) {
      throw tokenInvalid();
    }

    request[LOGIN_MEMBER_KEY] = memberId;
    return true;
  }
}
