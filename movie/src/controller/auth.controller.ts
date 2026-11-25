import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { LoginRequestDto } from '../dto/login-request.dto.js';
import { LoginRateLimitGuard } from '../guard/login-rate-limit.guard.js';
import { AuthService } from '../service/auth.service.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @UseGuards(LoginRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginRequestDto) {
    return {
      isSuccess: true,
      code: 'COMMON200',
      message: '로그인에 성공했습니다.',
      result: await this.authService.login(dto),
    };
  }
}