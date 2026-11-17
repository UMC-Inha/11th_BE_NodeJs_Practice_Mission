import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { LoginMember } from '../decorator/login-member.decorator.js';
import { ApiResponse } from '../dto/api-response.dto.js';
import { CheckResponseDto } from '../dto/check-response.dto.js';
import { CreateMemberDto } from '../dto/create-member.dto.js';
import { MemberInfoResponseDto } from '../dto/member-info-response.dto.js';
import { MemberResponseDto } from '../dto/member-response.dto.js';
import { MemberUpdateRequestDto } from '../dto/member-update-request.dto.js';
import { EmailParamDto, NicknameParamDto } from '../dto/member-request.dto.js';
import { AuthGuard } from '../guard/auth.guard.js';
import { MemberService } from '../service/member.service.js';

@Controller('members')
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  // GET /members/me → 토큰의 주인 본인의 정보. URL 어디에도 "누구"가 없다.
  // 고정 경로(me)를 변수 경로(:x)보다 위에 둔다. 아래에 members/:x 모양의 경로가 생기면 me 를 값으로 착각한다.
  @Get('me')
  @UseGuards(AuthGuard)
  async getMyInfo(
    @LoginMember() memberId: number,
  ): Promise<ApiResponse<MemberInfoResponseDto>> {
    const result = await this.memberService.getMyInfo(memberId);
    return ApiResponse.success(
      'COMMON200',
      '회원 정보를 조회했습니다.',
      result,
    );
  }

  // PATCH /members/me { nickname } → 200, 내 정보 조회와 같은 result
  @Patch('me')
  @UseGuards(AuthGuard)
  async updateMyInfo(
    @LoginMember() memberId: number,
    @Body() dto: MemberUpdateRequestDto,
  ): Promise<ApiResponse<MemberInfoResponseDto>> {
    const result = await this.memberService.updateMyInfo(memberId, dto);
    return ApiResponse.success(
      'COMMON200',
      '회원 정보를 수정했습니다.',
      result,
    );
  }

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
