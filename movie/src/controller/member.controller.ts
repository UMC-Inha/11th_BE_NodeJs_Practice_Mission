import { Controller, Get, Param } from '@nestjs/common';
import { CheckResponseDto } from '../dto/check-response.dto.js';
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
}
