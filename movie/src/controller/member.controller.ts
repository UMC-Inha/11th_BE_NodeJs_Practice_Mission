import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { CreateMemberDto } from "../dto/create-member.dto";
import { MemberUpdateRequestDto } from "../dto/member-update-request.dto";
import { MemberService } from "../service/member.service";
import { AuthGuard } from "../guard/auth.guard";
import type { AuthenticatedRequest } from "../guard/auth.guard";

@ApiTags("회원")
@Controller("members")
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  @ApiBearerAuth("bearerAuth")
  @ApiOperation({
    summary: "내 정보 조회",
    description:
      "토큰의 주인인 회원의 정보를 조회합니다. URL에 회원 번호를 받지 않고 토큰으로만 요청자를 식별합니다. 토큰이 필요합니다.",
  })
  @ApiResponse({
    status: 200,
    description: "조회 성공",
    schema: {
      example: {
        isSuccess: true,
        code: "COMMON200",
        message: "회원 정보를 조회했습니다.",
        result: {
          memberId: 1,
          email: "umc@inha.ac.kr",
          nickname: "영화조아",
          createdAt: "2026-11-25T21:00:00.000Z",
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: "토큰이 없거나 유효하지 않음 (AUTH401_2 / AUTH401_3)",
  })
  @Get("me")
  @UseGuards(AuthGuard)
  async getMyInfo(@Req() request: AuthenticatedRequest) {
    const result = await this.memberService.getMyInfo(request.memberId);

    return {
      isSuccess: true,
      code: "COMMON200",
      message: "회원 정보를 조회했습니다.",
      result,
    };
  }

  @ApiBearerAuth("bearerAuth")
  @ApiOperation({
    summary: "내 정보 수정",
    description:
      "토큰의 주인인 회원의 닉네임을 수정합니다. 다른 회원이 쓰고 있는 닉네임이면 실패합니다. 토큰이 필요합니다.",
  })
  @ApiResponse({
    status: 200,
    description: "수정 성공",
    schema: {
      example: {
        isSuccess: true,
        code: "COMMON200",
        message: "회원 정보를 수정했습니다.",
        result: {
          memberId: 1,
          email: "umc@inha.ac.kr",
          nickname: "우즈",
          createdAt: "2026-11-25T21:00:00.000Z",
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "닉네임 길이 등 입력값 검증 실패 (COMMON400)",
  })
  @ApiResponse({
    status: 401,
    description: "토큰이 없거나 유효하지 않음 (AUTH401_2 / AUTH401_3)",
  })
  @ApiResponse({
    status: 409,
    description: "다른 회원이 사용 중인 닉네임 (MEMBER409_1)",
    schema: {
      example: {
        isSuccess: false,
        code: "MEMBER409_1",
        message: "이미 사용 중인 닉네임입니다.",
        result: null,
      },
    },
  })
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

  @ApiOperation({
    summary: "닉네임 중복 확인",
    description:
      "회원가입 화면에서 입력한 닉네임을 쓸 수 있는지 확인합니다. 토큰이 필요 없는 공개 API입니다.",
  })
  @ApiParam({ name: "nickname", description: "확인할 닉네임", example: "우즈" })
  @ApiResponse({
    status: 200,
    description: "확인 성공",
    schema: { example: { available: true } },
  })
  @Get("nickname/:nickname")
  checkNickname(@Param("nickname") nickname: string) {
    return this.memberService.checkNickname(nickname);
  }

  @ApiOperation({
    summary: "이메일 중복 확인",
    description:
      "회원가입 화면에서 입력한 이메일을 쓸 수 있는지 확인합니다. 토큰이 필요 없는 공개 API입니다.",
  })
  @ApiParam({
    name: "email",
    description: "확인할 이메일",
    example: "umc@inha.ac.kr",
  })
  @ApiResponse({
    status: 200,
    description: "확인 성공",
    schema: { example: { available: true } },
  })
  @Get("email/:email")
  checkEmail(@Param("email") email: string) {
    return this.memberService.checkEmail(email);
  }

  @ApiOperation({
    summary: "회원가입",
    description:
      "이메일, 비밀번호, 닉네임으로 회원을 등록합니다. 토큰이 없어도 호출할 수 있는 공개 API입니다.",
  })
  @ApiResponse({
    status: 201,
    description: "회원가입 성공",
    schema: {
      example: {
        isSuccess: true,
        code: "COMMON201",
        message: "회원가입에 성공했습니다.",
        result: {
          memberId: 1,
          email: "umc@inha.ac.kr",
          nickname: "영화조아",
          createdAt: "2026-11-25T21:00:00.000Z",
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: "입력값 검증 실패 (COMMON400)",
  })
  @ApiResponse({
    status: 409,
    description: "이미 가입된 이메일 또는 사용 중인 닉네임 (MEMBER409_1)",
  })
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