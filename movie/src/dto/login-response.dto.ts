/** 로그인 성공 응답의 result. 이후 요청마다 Authorization: Bearer {accessToken} 으로 보낸다. */
export class LoginResponseDto {
  nickname: string;
  accessToken: string;
}
