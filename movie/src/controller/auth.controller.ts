import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiResponse } from '../dto/api-response.dto.js';
import { LoginRequestDto } from '../dto/login-request.dto.js';
import { LoginResponseDto } from '../dto/login-response.dto.js';
import { AuthService } from '../service/auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // POST /auth/login → 200 { isSuccess, code, message, result: { nickname, accessToken } }
  // 원칙대로라면 "토큰이라는 자원을 만든다"는 POST /auth/tokens 가 맞지만,
  // 프론트가 한눈에 알아보는 /auth/login 을 쓰는 예외다(워크북). @Post 의 기본 상태는 201 이라 200 으로 바꾼다.
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginRequestDto,
  ): Promise<ApiResponse<LoginResponseDto>> {
    const result = await this.authService.login(dto);
    return ApiResponse.success('COMMON200', '로그인에 성공했습니다.', result);
  }
}
