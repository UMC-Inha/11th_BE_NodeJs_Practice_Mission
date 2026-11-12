import {
  DEFAULT_ACCESS_EXPIRATION_SECONDS,
  buildJwtOptions,
  resolveAccessExpiration,
  resolveJwtSecret,
} from './jwt.config.js';

const goodSecret = 'k'.repeat(48);

describe('resolveJwtSecret (서버 시작 전 검사)', () => {
  it('32자 이상이면 그대로 쓴다', () => {
    expect(resolveJwtSecret(goodSecret)).toBe(goodSecret);
    expect(resolveJwtSecret('k'.repeat(32))).toHaveLength(32);
  });

  it('없거나 비어 있으면 서버를 띄우지 않는다', () => {
    expect(() => resolveJwtSecret(undefined)).toThrow('JWT_SECRET');
    expect(() => resolveJwtSecret('')).toThrow('JWT_SECRET');
  });

  it('31자 이하이면 서버를 띄우지 않는다', () => {
    expect(() => resolveJwtSecret('k'.repeat(31))).toThrow('32자');
  });

  it('.env.example 의 예시 값 그대로이면 서버를 띄우지 않는다', () => {
    expect(() =>
      resolveJwtSecret('change-me-this-is-only-a-placeholder-never-use-it'),
    ).toThrow('예시 값');
  });

  it('오류 메시지에 비밀키 값을 담지 않는다', () => {
    try {
      resolveJwtSecret('short-secret-value');
    } catch (error) {
      expect(String(error)).not.toContain('short-secret-value');
    }
  });
});

describe('resolveAccessExpiration (초 단위)', () => {
  it('없으면 3600초(1시간)', () => {
    expect(resolveAccessExpiration(undefined)).toBe(
      DEFAULT_ACCESS_EXPIRATION_SECONDS,
    );
    expect(resolveAccessExpiration('')).toBe(3600);
  });

  it('문자열로 들어온 숫자를 초 단위 숫자로 바꾼다', () => {
    expect(resolveAccessExpiration('60')).toBe(60);
    expect(typeof resolveAccessExpiration('3600')).toBe('number');
  });

  it.each(['1h', '0', '-5', '1.5', 'abc'])(
    '%s 는 받지 않는다(1 이상의 정수 초만)',
    (raw) => {
      expect(() => resolveAccessExpiration(raw)).toThrow(
        'JWT_ACCESS_EXPIRATION',
      );
    },
  );
});

describe('buildJwtOptions', () => {
  it('서명 알고리즘을 HS256 으로 고정하고 유효시간을 초 단위 숫자로 넘긴다', () => {
    const options = buildJwtOptions({
      JWT_SECRET: goodSecret,
      JWT_ACCESS_EXPIRATION: '60',
    });
    expect(options.secret).toBe(goodSecret);
    expect(options.signOptions).toEqual({ algorithm: 'HS256', expiresIn: 60 });
    expect(options.verifyOptions).toEqual({ algorithms: ['HS256'] });
  });
});
