import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Length } from 'class-validator';

/** PATCH /members/me 요청 Body. 규칙은 회원가입의 닉네임과 같다(2~12자). */
export class MemberUpdateRequestDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: '닉네임을 입력해주세요.' })
  @IsNotEmpty({ message: '닉네임을 입력해주세요.' })
  @Length(2, 12, { message: '닉네임은 2자 이상 12자 이하여야 합니다.' })
  nickname: string;
}
