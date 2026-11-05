import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import { ApiResponse } from '../dto/api-response.dto.js';
import { CheckResponseDto } from '../dto/check-response.dto.js';
import { CreateMemberDto } from '../dto/create-member.dto.js';
import { MemberResponseDto } from '../dto/member-response.dto.js';
import { EmailParamDto, NicknameParamDto } from '../dto/member-request.dto.js';
import { MemberService } from '../service/member.service.js';

@Controller('members')
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  // GET /members/nickname/{nickname}
  @Get('nickname/:nickname')
  checkNickname(
    @Param() { nickname }: NicknameParamDto,
  ): Promise<CheckResponseDto> {
    return this.memberService.checkNickname(nickname);
  }

  // GET /members/email/{email}
  @Get('email/:email')
  checkEmail(@Param() { email }: EmailParamDto): Promise<CheckResponseDto> {
    return this.memberService.checkEmail(email);
  }

  // POST /members  → 201 { isSuccess, code, message, result: { memberId, email, nickname } }
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async signUp(
    @Body() dto: CreateMemberDto,
  ): Promise<ApiResponse<MemberResponseDto>> {
    const result = await this.memberService.signUp(dto);
    return ApiResponse.success('COMMON201', '회원가입에 성공했습니다.', result);
  }
}
