import { ExecutionContext } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHmac } from 'node:crypto';
import { buildJwtOptions } from '../config/jwt.config.js';
import { ApiException } from '../exception/api.exception.js';
import { AuthGuard, extractBearerToken } from './auth.guard.js';
import { AuthenticatedRequest } from './authenticated-request.js';

const secret = 'guard-spec-only-secret-'.padEnd(48, 'x');
const jwt = new JwtService(
  buildJwtOptions({ JWT_SECRET: secret, JWT_ACCESS_EXPIRATION: '3600' }),
);
// 만료된 토큰을 만들려고 유효시간 설정이 없는 서비스를 따로 둔다(exp 를 payload 로 직접 넣는다).
const rawJwt = new JwtService({ secret });
const guard = new AuthGuard(jwt);

function contextWith(authorization?: string) {
  const request = {
    headers: authorization === undefined ? {} : { authorization },
  } as AuthenticatedRequest;
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { request, context };
}

/** 가드가 던진 ApiException 의 상태·code 를 돌려준다. 통과하면 null. */
async function rejection(authorization?: string) {
  const { context } = contextWith(authorization);
  const error = await guard.canActivate(context).then(
    () => null,
    (e: unknown) => e,
  );
  if (error === null) return null;
  expect(error).toBeInstanceOf(ApiException);
  const api = error as ApiException;
  return { status: api.getStatus(), code: api.code, message: api.message };
}

/** 토큰의 segment(0 header, 1 payload, 2 signature) 안 position 번째 글자를 "다른 글자로 교체"한다. 덧붙이지 않는다. */
function replaceChar(token: string, segment: number, position: number) {
  const parts = token.split('.');
  const target = parts[segment];
  const swapped = target[position] === 'A' ? 'B' : 'A';
  parts[segment] =
    target.slice(0, position) + swapped + target.slice(position + 1);
  return parts.join('.');
}

const base64url = (value: object) =>
  Buffer.from(JSON.stringify(value)).toString('base64url');

describe('extractBearerToken', () => {
  it('"Bearer {토큰}" 에서 토큰만 꺼낸다 (Bearer 뒤 한 칸)', () => {
    expect(extractBearerToken('Bearer abc.def.ghi')).toBe('abc.def.ghi');
  });

  it('스킴 대소문자는 구분하지 않는다', () => {
    expect(extractBearerToken('bearer abc')).toBe('abc');
  });

  it.each([
    undefined,
    '',
    'Bearer',
    'Bearer ',
    'Bearer    ',
    'Basic abc',
    'abc.def.ghi',
  ])('%j 는 토큰이 없는 것으로 본다', (header) => {
    expect(extractBearerToken(header)).toBeNull();
  });
});

describe('AuthGuard (인증)', () => {
  it('올바른 토큰이면 통과하고 요청에 회원 번호를 숫자로 담는다', async () => {
    const token = await jwt.signAsync({ sub: '7', email: 'a@b.com' });
    const { request, context } = contextWith(`Bearer ${token}`);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.memberId).toBe(7);
  });

  it('Authorization 헤더가 없으면 401 AUTH401_2', async () => {
    await expect(rejection()).resolves.toEqual({
      status: 401,
      code: 'AUTH401_2',
      message: '로그인이 필요한 요청입니다.',
    });
  });

  it('Bearer 형식이 아니거나 토큰이 비어 있어도 AUTH401_2', async () => {
    for (const header of ['Basic dXNlcjpwdw==', 'Bearer ', 'token-only']) {
      expect((await rejection(header))?.code, header).toBe('AUTH401_2');
    }
  });

  it('payload 의 글자 하나를 "교체"하면 서명이 맞지 않아 401 AUTH401_3', async () => {
    const token = await jwt.signAsync({ sub: '1', email: 'a@b.com' });
    const tampered = replaceChar(token, 1, 10);
    expect(tampered).not.toBe(token);
    expect(tampered).toHaveLength(token.length);

    await expect(rejection(`Bearer ${tampered}`)).resolves.toEqual({
      status: 401,
      code: 'AUTH401_3',
      message: '유효하지 않은 토큰입니다.',
    });
  });

  it('서명의 글자 하나를 교체해도 AUTH401_3', async () => {
    const token = await jwt.signAsync({ sub: '1', email: 'a@b.com' });
    const tampered = replaceChar(token, 2, 10);
    expect((await rejection(`Bearer ${tampered}`))?.code).toBe('AUTH401_3');
  });

  it('다른 비밀키로 서명한 토큰은 AUTH401_3', async () => {
    const foreign = await new JwtService({ secret: 'z'.repeat(48) }).signAsync({
      sub: '1',
    });
    expect((await rejection(`Bearer ${foreign}`))?.code).toBe('AUTH401_3');
  });

  it('토큰이 아닌 문자열은 AUTH401_3', async () => {
    expect((await rejection('Bearer not.a.jwt'))?.code).toBe('AUTH401_3');
    expect((await rejection('Bearer abc'))?.code).toBe('AUTH401_3');
  });

  it('유효시간이 지난 토큰은 401 AUTH401_4 — 토큰이 없을 때(AUTH401_2)와 구분된다', async () => {
    const expired = await rawJwt.signAsync({
      sub: '1',
      exp: Math.floor(Date.now() / 1000) - 10,
    });
    const missing = await rejection();
    const result = await rejection(`Bearer ${expired}`);

    expect(result).toEqual({
      status: 401,
      code: 'AUTH401_4',
      message: '토큰이 만료되었습니다. 다시 로그인해주세요.',
    });
    expect(result?.status).toBe(missing?.status); // 둘 다 401
    expect(result?.code).not.toBe(missing?.code); // 하지만 이유(code)는 다르다
  });

  it('만료된 토큰도 서명이 틀리면 만료가 아니라 위조(AUTH401_3)로 본다', async () => {
    const expired = await rawJwt.signAsync({
      sub: '1',
      exp: Math.floor(Date.now() / 1000) - 10,
    });
    expect(
      (await rejection(`Bearer ${replaceChar(expired, 2, 10)}`))?.code,
    ).toBe('AUTH401_3');
  });

  it('서명 없는 토큰(alg=none)은 AUTH401_3', async () => {
    const unsigned = `${base64url({ alg: 'none', typ: 'JWT' })}.${base64url({ sub: '1' })}.`;
    expect((await rejection(`Bearer ${unsigned}`))?.code).toBe('AUTH401_3');
  });

  it('같은 비밀키로 HS384 로 서명한 토큰도 거절한다 (알고리즘은 HS256 으로 고정)', async () => {
    const header = base64url({ alg: 'HS384', typ: 'JWT' });
    const payload = base64url({
      sub: '1',
      exp: Math.floor(Date.now() / 1000) + 600,
    });
    const signature = createHmac('sha384', secret)
      .update(`${header}.${payload}`)
      .digest('base64url');
    expect(
      (await rejection(`Bearer ${header}.${payload}.${signature}`))?.code,
    ).toBe('AUTH401_3');
  });

  it('서명은 맞아도 sub 가 회원 번호가 아니면 AUTH401_3', async () => {
    for (const sub of ['abc', '0', '-3', '1.5', '']) {
      const token = await jwt.signAsync({ sub, email: 'a@b.com' });
      expect((await rejection(`Bearer ${token}`))?.code, sub).toBe('AUTH401_3');
    }
  });

  it('통과하지 못하면 요청에 회원 번호를 담지 않는다', async () => {
    const { request, context } = contextWith('Bearer abc');
    await guard.canActivate(context).catch(() => undefined);
    expect(request.memberId).toBeUndefined();
  });
});
