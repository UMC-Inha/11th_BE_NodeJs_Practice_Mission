import 'reflect-metadata';
import { ExecutionContext } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants.js';
import { readFileSync } from 'node:fs';
import {
  AuthenticatedRequest,
  LOGIN_MEMBER_KEY,
} from '../guard/authenticated-request.js';
import { LoginMember } from './login-member.decorator.js';

/** 데코레이터를 붙인 가짜 핸들러. Nest 가 저장해 둔 메타데이터에서 값을 꺼내는 함수(factory)를 얻는다. */
class Probe {
  handler(@LoginMember() _memberId: number) {
    return undefined;
  }
}

type Factory = (data: unknown, context: ExecutionContext) => number;

function factoryOf(): Factory {
  const metadata = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    Probe,
    'handler',
  ) as Record<string, { factory: Factory }>;
  return Object.values(metadata)[0].factory;
}

const contextWith = (request: Partial<AuthenticatedRequest>) =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as ExecutionContext;

describe('@LoginMember()', () => {
  it('AuthGuard 가 요청에 담아 둔 회원 번호를 그대로 돌려준다', () => {
    const request = { [LOGIN_MEMBER_KEY]: 7 } as Partial<AuthenticatedRequest>;
    expect(factoryOf()(undefined, contextWith(request))).toBe(7);
  });

  it('요청에 회원 번호가 없으면(가드를 빠뜨린 경우) 조용히 undefined 를 주지 않고 오류를 낸다', () => {
    expect(() => factoryOf()(undefined, contextWith({}))).toThrow(
      '@UseGuards(AuthGuard)',
    );
  });
});

describe('컨트롤러는 요청 객체의 키 이름을 직접 쓰지 않는다 (선택 미션 2)', () => {
  const controllers = ['auth', 'member', 'rating'].map((name) => ({
    name,
    source: readFileSync(
      new URL(`../controller/${name}.controller.ts`, import.meta.url),
      'utf8',
    ),
  }));

  it.each(controllers)(
    '$name.controller.ts 에 request["memberId"] / @Req() 가 없다',
    ({ source }) => {
      expect(source).not.toMatch(/request\[\s*['"]memberId['"]\s*\]/);
      expect(source).not.toContain('@Req(');
    },
  );

  it('"memberId" 문자열은 공개 조회 API 의 경로 변수(:memberId)에서만 나온다', () => {
    const lines = controllers
      .flatMap(({ name, source }) =>
        source
          .split('\n')
          .map((line, index) => ({ name, line, number: index + 1 })),
      )
      .filter(
        ({ line }) =>
          /['"]memberId['"]/.test(line) && !line.trim().startsWith('//'),
      )
      .map(({ line }) => line.trim());
    expect(lines).toEqual([
      "@Param('memberId', ParseIntPipe) memberId: number,",
    ]);
  });
});
