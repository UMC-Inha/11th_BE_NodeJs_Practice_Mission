import type { JwtModuleOptions } from '@nestjs/jwt';

/** HS256 은 256비트(32바이트) 이상의 키를 요구한다. */
export const MIN_JWT_SECRET_LENGTH = 32;
export const DEFAULT_ACCESS_EXPIRATION_SECONDS = 3600;

/** .env.example 에 적어 둔 예시 값. 복사만 하고 바꾸지 않은 채로는 서버가 뜨지 않게 한다. */
const PLACEHOLDER_PREFIX = 'change-me';

/**
 * JWT_SECRET 이 없거나 짧으면 서버를 띄우지 않는다.
 * 비밀키를 아는 사람은 누구나 원하는 내용으로 토큰을 만들 수 있으니, 약한 키로 조용히 시작하는 것보다 시작을 막는 편이 낫다.
 */
export function resolveJwtSecret(raw: string | undefined): string {
  if (!raw || raw.length < MIN_JWT_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET 이 없거나 ${MIN_JWT_SECRET_LENGTH}자보다 짧습니다. .env 에 32자 이상의 무작위 문자열을 넣어 주세요. (openssl rand -base64 48)`,
    );
  }
  if (raw.startsWith(PLACEHOLDER_PREFIX)) {
    throw new Error(
      'JWT_SECRET 이 .env.example 의 예시 값 그대로입니다. 무작위 문자열로 바꿔 주세요.',
    );
  }
  return raw;
}

/**
 * JWT_ACCESS_EXPIRATION(초). 환경변수는 문자열이라 숫자로 바꿔서 쓴다.
 * "1h" 같은 표기는 받지 않는다. Spring 과 같은 단위(초)로 맞추기 위해서다.
 */
export function resolveAccessExpiration(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') {
    return DEFAULT_ACCESS_EXPIRATION_SECONDS;
  }
  const seconds = Number(raw);
  if (!Number.isInteger(seconds) || seconds < 1) {
    throw new Error(
      `JWT_ACCESS_EXPIRATION 은 1 이상의 정수(초)여야 합니다. 받은 값: ${raw}`,
    );
  }
  return seconds;
}

export function buildJwtOptions(env: {
  JWT_SECRET?: string;
  JWT_ACCESS_EXPIRATION?: string;
}): JwtModuleOptions {
  return {
    secret: resolveJwtSecret(env.JWT_SECRET),
    // 알고리즘을 고정해 두면 헤더의 alg 를 바꿔 끼우는 공격(alg 혼동)을 처음부터 막는다.
    signOptions: {
      algorithm: 'HS256',
      expiresIn: resolveAccessExpiration(env.JWT_ACCESS_EXPIRATION),
    },
    verifyOptions: { algorithms: ['HS256'] },
  };
}
