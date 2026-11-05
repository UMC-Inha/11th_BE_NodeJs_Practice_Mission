import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateMemberDto } from './create-member.dto.js';
import { CreateRatingDto } from './create-rating.dto.js';
import { UpdateRatingDto } from './update-rating.dto.js';

/** ValidationPipe({ transform: true }) 와 같은 순서(변환 → 검증)로 첫 번째 위반 메시지를 돌려준다. */
async function firstError<T extends object>(
  type: new () => T,
  plain: Record<string, unknown>,
) {
  const errors = await validate(plainToInstance(type, plain));
  return errors[0] ? Object.values(errors[0].constraints ?? {})[0] : undefined;
}

const valid = {
  email: 'umc@example.com',
  password: 'Umc!1234',
  nickname: 'moviefan',
};

describe('CreateMemberDto', () => {
  it('정상 값은 통과', async () => {
    expect(await firstError(CreateMemberDto, valid)).toBeUndefined();
  });

  it('이메일 형식이 틀리면 거절', async () => {
    expect(
      await firstError(CreateMemberDto, { ...valid, email: 'not-email' }),
    ).toBe('올바른 이메일 형식이 아닙니다.');
    expect(
      await firstError(CreateMemberDto, { ...valid, email: '' }),
    ).toBeDefined();
  });

  it('닉네임은 2~12자 (앞뒤 공백은 지우고 센다)', async () => {
    expect(await firstError(CreateMemberDto, { ...valid, nickname: 'a' })).toBe(
      '닉네임은 2자 이상이어야 합니다.',
    );
    expect(
      await firstError(CreateMemberDto, {
        ...valid,
        nickname: '가'.repeat(13),
      }),
    ).toBe('닉네임은 12자 이하여야 합니다.');
    expect(
      await firstError(CreateMemberDto, {
        ...valid,
        nickname: '가'.repeat(12),
      }),
    ).toBeUndefined();
    expect(
      await firstError(CreateMemberDto, { ...valid, nickname: '  a  ' }),
    ).toBeDefined();
    expect(
      await firstError(CreateMemberDto, { ...valid, nickname: '   ' }),
    ).toBeDefined();
  });

  it.each([
    ['대문자 없음', 'umc!1234'],
    ['소문자 없음', 'UMC!1234'],
    ['숫자 없음', 'Umc!abcd'],
    ['특수문자 없음', 'Umc12345'],
    ['8자 미만', 'Um!1234'],
  ])('비밀번호 %s → 거절', async (_name, password) => {
    expect(await firstError(CreateMemberDto, { ...valid, password })).toBe(
      '비밀번호는 대문자/소문자/숫자/특수문자를 포함한 8자 이상이어야 합니다.',
    );
  });

  it('비밀번호 특수문자는 !@#$%^&* 말고도 허용, 72자 초과는 거절', async () => {
    expect(
      await firstError(CreateMemberDto, { ...valid, password: 'Umc_1234' }),
    ).toBeUndefined();
    expect(
      await firstError(CreateMemberDto, {
        ...valid,
        password: `Aa1!${'x'.repeat(69)}`,
      }),
    ).toBe('비밀번호는 72자 이하여야 합니다.');
  });
});

describe('CreateRatingDto / UpdateRatingDto', () => {
  it('정상 값은 통과 (comment 는 선택)', async () => {
    expect(
      await firstError(CreateRatingDto, { movieId: 550, score: 5 }),
    ).toBeUndefined();
    expect(
      await firstError(CreateRatingDto, {
        movieId: 550,
        score: 1,
        comment: '좋아요',
      }),
    ).toBeUndefined();
  });

  it.each([0, 6, 1.5, '5', null])('score=%s → 거절', async (score) => {
    expect(
      await firstError(CreateRatingDto, { movieId: 550, score }),
    ).toBeDefined();
    expect(await firstError(UpdateRatingDto, { score })).toBeDefined();
  });

  it.each([0, -1, 1.5, '550'])('movieId=%s → 거절', async (movieId) => {
    expect(
      await firstError(CreateRatingDto, { movieId, score: 5 }),
    ).toBeDefined();
  });

  it('comment 는 500자까지', async () => {
    expect(
      await firstError(CreateRatingDto, {
        movieId: 1,
        score: 5,
        comment: 'a'.repeat(500),
      }),
    ).toBeUndefined();
    expect(
      await firstError(CreateRatingDto, {
        movieId: 1,
        score: 5,
        comment: 'a'.repeat(501),
      }),
    ).toBe('후기는 500자 이하로 입력해주세요.');
    expect(
      await firstError(CreateRatingDto, { movieId: 1, score: 5, comment: 123 }),
    ).toBeDefined();
  });

  it('수정은 comment 생략 또는 null 이면 통과', async () => {
    expect(await firstError(UpdateRatingDto, { score: 3 })).toBeUndefined();
    expect(
      await firstError(UpdateRatingDto, { score: 3, comment: null }),
    ).toBeUndefined();
  });
});
