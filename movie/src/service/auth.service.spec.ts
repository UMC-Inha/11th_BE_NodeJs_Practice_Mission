import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { buildJwtOptions } from '../config/jwt.config.js';
import { Member } from '../entity/member.entity.js';
import { ApiException } from '../exception/api.exception.js';
import { AuthService } from './auth.service.js';

const jwt = new JwtService(
  buildJwtOptions({
    JWT_SECRET: 'auth-service-spec-secret-'.padEnd(48, 'x'),
    JWT_ACCESS_EXPIRATION: '3600',
  }),
);

const createdAt = new Date('2026-09-02T12:14:03Z');

describe('AuthService.login', () => {
  let stored: Member;

  beforeAll(async () => {
    stored = {
      memberId: 7,
      email: 'movie@umc.com',
      password: await bcrypt.hash('Umc!1234', 4), // 테스트라 cost 를 낮췄다
      nickname: '영화광',
      createdAt,
      updatedAt: createdAt,
    };
  });

  function setup(found: Member | null = stored) {
    const repository = { findOne: vi.fn().mockResolvedValue(found) };
    return {
      repository,
      service: new AuthService(
        repository as unknown as Repository<Member>,
        jwt,
      ),
    };
  }

  /** 던져진 ApiException 을 돌려준다. */
  async function failure(promise: Promise<unknown>) {
    const error = await promise.then(
      () => null,
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ApiException);
    return error as ApiException;
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('성공하면 nickname 과 accessToken 을 돌려준다', async () => {
    const { service, repository } = setup();
    const result = await service.login({
      email: 'movie@umc.com',
      password: 'Umc!1234',
    });

    expect(repository.findOne).toHaveBeenCalledWith({
      where: { email: 'movie@umc.com' },
    });
    expect(Object.keys(result)).toEqual(['nickname', 'accessToken']);
    expect(result.nickname).toBe('영화광');
    expect(result.accessToken.split('.')).toHaveLength(3);
  });

  it('토큰 payload 에는 sub·email·iat·exp 만 있고 비밀번호는 없다 (payload 는 누구나 읽을 수 있다)', async () => {
    const { service } = setup();
    const { accessToken } = await service.login({
      email: 'movie@umc.com',
      password: 'Umc!1234',
    });

    const payload = JSON.parse(
      Buffer.from(accessToken.split('.')[1], 'base64url').toString(),
    ) as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(['email', 'exp', 'iat', 'sub']);
    expect(payload.sub).toBe('7');
    expect(payload.email).toBe('movie@umc.com');
    expect(payload.exp).toBe((payload.iat as number) + 3600);
    expect(accessToken).not.toContain('Umc!1234');
    expect(JSON.stringify(payload)).not.toContain('$2');
  });

  it('발급한 토큰은 같은 키로 검증되고 sub 가 회원 번호다', async () => {
    const { service } = setup();
    const { accessToken } = await service.login({
      email: 'movie@umc.com',
      password: 'Umc!1234',
    });
    await expect(jwt.verifyAsync(accessToken)).resolves.toMatchObject({
      sub: '7',
    });
  });

  it('없는 이메일과 틀린 비밀번호는 상태·code·message 가 똑같다', async () => {
    const unknownEmail = await failure(
      setup(null).service.login({
        email: 'nobody@umc.com',
        password: 'Umc!1234',
      }),
    );
    const wrongPassword = await failure(
      setup().service.login({ email: 'movie@umc.com', password: 'Wrong!1234' }),
    );

    expect(unknownEmail.getStatus()).toBe(401);
    expect(unknownEmail.code).toBe('AUTH401_1');
    expect(unknownEmail.message).toBe(
      '이메일 또는 비밀번호가 올바르지 않습니다.',
    );
    expect(wrongPassword.getStatus()).toBe(unknownEmail.getStatus());
    expect(wrongPassword.code).toBe(unknownEmail.code);
    expect(wrongPassword.message).toBe(unknownEmail.message);
    expect(wrongPassword.getResponse()).toEqual(unknownEmail.getResponse());
  });

  it('없는 이메일에도 bcrypt 비교를 한 번 한다 (응답 시간으로 가입 여부를 알 수 없게)', async () => {
    const compare = vi.spyOn(bcrypt, 'compare');
    await failure(
      setup(null).service.login({ email: 'nobody@umc.com', password: 'x' }),
    );
    expect(compare).toHaveBeenCalledTimes(1);
    // 가짜 해시는 cost 10 의 올바른 bcrypt 해시여야 실제 비교 시간이 든다
    expect(String(compare.mock.calls[0][1])).toMatch(/^\$2[aby]\$10\$.{53}$/);
  });

  it('시드 데이터처럼 올바르지 않은 해시가 저장돼 있어도 500 이 아니라 로그인 실패로 답한다', async () => {
    const seeded = Object.assign({}, stored, {
      password: '$2a$10$dummyEncodedPasswordValue',
    });
    const error = await failure(
      setup(seeded).service.login({
        email: 'movie@umc.com',
        password: 'Umc!1234',
      }),
    );
    expect(error.code).toBe('AUTH401_1');
  });

  it('토큰 발급 실패 시에는 토큰 없이 오류가 그대로 올라간다 (성공처럼 보이지 않는다)', async () => {
    const { service } = setup();
    vi.spyOn(jwt, 'signAsync').mockRejectedValue(new Error('sign failed'));
    await expect(
      service.login({ email: 'movie@umc.com', password: 'Umc!1234' }),
    ).rejects.toThrow('sign failed');
  });
});
