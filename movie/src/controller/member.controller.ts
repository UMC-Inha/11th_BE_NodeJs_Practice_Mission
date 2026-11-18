import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
  Patch,
} from "@nestjs/common";
import { CreateMemberDto } from "../dto/create-member.dto";
import { MemberService } from "../service/member.service";
import { AuthGuard } from "../guard/auth.guard";
import { MemberUpdateRequestDto } from "../dto/member-update-request.dto";
// 데코레이터가 붙은 매개변수의 타입은 import type으로 가져와야 합니다
import type { AuthenticatedRequest } from "../guard/auth.guard";

@Controller("members")
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  @Get("me")
  @UseGuards(AuthGuard) // 이 줄이 없으면 토큰 없이도 호출됩니다
  async getMyInfo(@Req() request: AuthenticatedRequest) {
    // Guard가 담아둔 값을 꺼냅니다
    const result = await this.memberService.getMyInfo(request.memberId);

    return {
      isSuccess: true,
      code: "COMMON200",
      message: "회원 정보를 조회했습니다.",
      result,
    };
  }

  @Get("nickname/:nickname")
  checkNickname(@Param("nickname") nickname: string) {
    return this.memberService.checkNickname(nickname);
  }

  @Get("email/:email")
  checkEmail(@Param("email") email: string) {
    return this.memberService.checkEmail(email);
  }

  @Patch("me")
  @UseGuards(AuthGuard)
  async updateMyInfo(
    @Req() request: AuthenticatedRequest,
    @Body() dto: MemberUpdateRequestDto,
  ) {
    const result = await this.memberService.updateMyInfo(request.memberId, dto);

    return {
      isSuccess: true,
      code: "COMMON200",
      message: "회원 정보를 수정했습니다.",
      result,
    };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async signUp(@Body() dto: CreateMemberDto) {
    const result = await this.memberService.signUp(dto);

    return {
      isSuccess: true,
      code: "COMMON201",
      message: "회원가입에 성공했습니다.",
      result,
    };
  }
}