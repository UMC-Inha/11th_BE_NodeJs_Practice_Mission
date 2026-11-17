import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/** 앞뒤 공백은 값이 아니라 입력 실수이므로 검증 전에 지운다. */
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** POST /members 요청 Body. 규칙은 워크북 "회원가입 입력 규칙"을 따른다. */
export class CreateMemberDto {
  // member.email 컬럼 길이(RFC 5321 최대 254자)를 넘기면 DB 오류가 되므로 먼저 막는다.
  @Transform(trim)
  @MaxLength(254, { message: '이메일은 254자 이하로 입력해 주세요.' })
  @IsEmail({}, { message: '올바른 이메일 형식이 아닙니다.' })
  email: string;

  // 대문자·소문자·숫자·특수문자(영문·숫자·공백이 아닌 문자)를 모두 포함한 8자 이상.
  // bcrypt 는 72바이트 뒤를 무시하므로 상한도 둔다.
  @IsString({ message: '비밀번호를 입력해 주세요.' })
  @MaxLength(72, { message: '비밀번호는 72자 이하여야 합니다.' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,}$/, {
    message:
      '비밀번호는 대문자/소문자/숫자/특수문자를 포함한 8자 이상이어야 합니다.',
  })
  password: string;

  @Transform(trim)
  @IsString({ message: '닉네임을 입력해 주세요.' })
  @IsNotEmpty({ message: '닉네임을 입력해 주세요.' })
  @MinLength(2, { message: '닉네임은 2자 이상이어야 합니다.' })
  @MaxLength(12, { message: '닉네임은 12자 이하여야 합니다.' })
  nickname: string;
}
