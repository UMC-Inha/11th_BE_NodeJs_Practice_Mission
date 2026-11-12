import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import {
  AuthenticatedRequest,
  LOGIN_MEMBER_KEY,
} from '../guard/authenticated-request.js';

/**
 * 로그인한 회원의 번호를 파라미터로 바로 받는다. 이 값은 요청 Body·URL 이 아니라 AuthGuard 가 토큰에서 꺼낸 것이다.
 *
 *   @Post('ratings')
 *   @UseGuards(AuthGuard)
 *   create(@LoginMember() memberId: number, @Body() dto: CreateRatingDto) { ... }
 *
 * 컨트롤러가 요청 객체의 키 이름("memberId")을 직접 알 필요가 없어서, 키를 바꿔도 이 파일과 가드만 고치면 된다.
 * 꼭 @UseGuards(AuthGuard) 와 함께 쓴다.
 */
export const LoginMember = createParamDecorator(
  (_data: unknown, context: ExecutionContext): number => {
    const memberId = context.switchToHttp().getRequest<AuthenticatedRequest>()[
      LOGIN_MEMBER_KEY
    ];
    if (memberId === undefined) {
      // 가드를 붙이지 않은 곳에서 쓴 개발 실수다. 토큰 없는 요청이 통과했다는 뜻이므로 조용히 넘어가지 않고 500 으로 드러낸다.
      throw new Error(
        '@LoginMember() 는 @UseGuards(AuthGuard) 가 붙은 핸들러에서만 쓸 수 있습니다.',
      );
    }
    return memberId;
  },
);
