import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ApiResponse } from '../dto/api-response.dto.js';
import { LoginRequestDto } from '../dto/login-request.dto.js';
import { LoginResponseDto } from '../dto/login-response.dto.js';
import { loginFailed } from '../exception/api.exception.js';
import { AuthService } from '../service/auth.service.js';
import { ApiFailure, ApiSuccess, failureBody } from '../swagger/api-docs.js';

@ApiTags('인증')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /auth/login → 200 { isSuccess, code, message, result: { nickname, accessToken } }
  // 원칙대로라면 "토큰이라는 자원을 만든다"는 POST /auth/tokens 가 맞지만,
  // 프론트가 한눈에 알아보는 /auth/login 을 쓰는 예외다(워크북). @Post 의 기본 상태는 201 이라 200 으로 바꾼다.
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '로그인 (공개 — 토큰 필요 없음)',
    description:
      '이메일이 없는 경우와 비밀번호가 틀린 경우는 같은 응답(AUTH401_1)이다. 성공하면 accessToken 을 발급한다.',
  })
  @ApiBody({
    schema: {
      example: { email: 'viewer1@umc.com', password: 'Umc!1234' },
    },
  })
  @ApiSuccess(200, '로그인 성공', 'COMMON200', '로그인에 성공했습니다.', {
    nickname: '뷰어1',
    accessToken: 'eyJhbGciOiJIUzI1NiIs…',
  })
  @ApiFailure(401, '이메일 또는 비밀번호가 올바르지 않음', {
    [loginFailed().code]: failureBody(loginFailed()),
  })
  async login(
    @Body() dto: LoginRequestDto,
  ): Promise<ApiResponse<LoginResponseDto>> {
    const result = await this.authService.login(dto);
    return ApiResponse.success('COMMON200', '로그인에 성공했습니다.', result);
  }
}
