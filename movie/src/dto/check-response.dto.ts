/** 닉네임·이메일 중복 체크 응답. 쓸 수 있으면(아직 아무도 안 쓰면) true */
export class CheckResponseDto {
  available: boolean;

  static of(exists: boolean): CheckResponseDto {
    return { available: !exists };
  }
}
