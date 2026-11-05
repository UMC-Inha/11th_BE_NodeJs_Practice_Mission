import { DEFAULT_CORS_ORIGIN, parseCorsOrigins } from './app.setup.js';

describe('parseCorsOrigins', () => {
  it('비어 있으면 5173 하나만 허용', () => {
    expect(parseCorsOrigins(undefined)).toEqual([DEFAULT_CORS_ORIGIN]);
    expect(parseCorsOrigins(' , ')).toEqual([DEFAULT_CORS_ORIGIN]);
  });

  it('쉼표로 여러 출처, 공백은 지운다', () => {
    expect(
      parseCorsOrigins('http://localhost:5173, http://localhost:5174'),
    ).toEqual(['http://localhost:5173', 'http://localhost:5174']);
  });

  it('* 이면 모든 출처', () => {
    expect(parseCorsOrigins('*')).toBe('*');
  });
});
