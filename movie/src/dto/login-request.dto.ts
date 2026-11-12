import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** POST /auth/login 요청 Body */
export class LoginRequestDto {
  // 회원가입 때 앞뒤 공백을 지우고 저장하므로 로그인도 똑같이 지우고 찾는다.
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @MaxLength(254, { message: '이메일은 254자 이하로 입력해 주세요.' })
  @IsEmail({}, { message: '이메일 형식이 올바르지 않습니다.' })
  @IsNotEmpty({ message: '이메일을 입력해주세요.' })
  email: string;

  // 로그인 단계에서는 비밀번호 규칙(대소문자/숫자/특수문자)까지 검사하지 않는다.
  // 규칙이 바뀌기 전에 가입한 회원이 로그인조차 못 하게 되기 때문이다. 맞는지는 bcrypt 비교가 알려 준다.
  @IsString({ message: '비밀번호를 입력해주세요.' })
  @IsNotEmpty({ message: '비밀번호를 입력해주세요.' })
  password: string;
}
