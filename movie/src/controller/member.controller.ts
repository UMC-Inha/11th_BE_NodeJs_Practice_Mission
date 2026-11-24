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
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
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
import {
  ApiAuthFailures,
  ApiFailure,
  ApiMemberNotFound,
  ApiNicknameDuplicated,
  ApiRawSuccess,
  ApiSignUpDuplicated,
  ApiSuccess,
  validationFailureBody,
} from '../swagger/api-docs.js';

const SAMPLE_MY_INFO = {
  email: 'kevin@example.com',
  nickname: '케빈',
  createdAt: '2026-11-18T05:00:00.000Z',
};

@ApiTags('회원')
@Controller('members')
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  // GET /members/me → 토큰의 주인 본인의 정보. URL 어디에도 "누구"가 없다.
  // 고정 경로(me)를 변수 경로(:x)보다 위에 둔다. 아래에 members/:x 모양의 경로가 생기면 me 를 값으로 착각한다.
  @Get('me')
  @UseGuards(AuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '내 정보 조회 (토큰 필요)',
    description:
      '토큰의 주인 본인의 이메일·닉네임·가입일을 돌려준다. URL 과 Body 어디에도 memberId 가 없다. ' +
      '로그인 응답에는 닉네임만 있으므로, 앱을 다시 켠 뒤 토큰이 아직 유효한지 확인하는 데도 쓴다.',
  })
  @ApiSuccess(
    200,
    '내 정보 (password 는 나가지 않는다)',
    'COMMON200',
    '회원 정보를 조회했습니다.',
    SAMPLE_MY_INFO,
  )
  @ApiAuthFailures()
  @ApiMemberNotFound()
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
  @ApiBearerAuth()
  @ApiOperation({
    summary: '내 정보(닉네임) 수정 (토큰 필요)',
    description:
      '내 닉네임을 바꾼다. 앞뒤 공백은 지운 뒤 2~12자여야 하고, 다른 회원이 쓰는 닉네임이면 409 MEMBER409_1 이다.',
  })
  @ApiBody({
    type: MemberUpdateRequestDto,
    examples: { 기본: { value: { nickname: '케빈' } } },
  })
  @ApiSuccess(
    200,
    '수정된 내 정보',
    'COMMON200',
    '회원 정보를 수정했습니다.',
    SAMPLE_MY_INFO,
  )
  @ApiFailure(400, '닉네임 입력 규칙을 통과하지 못함 (바뀌지 않는다)', {
    '닉네임 길이 오류': validationFailureBody(
      '닉네임은 2자 이상 12자 이하여야 합니다.',
    ),
  })
  @ApiAuthFailures()
  @ApiMemberNotFound()
  @ApiNicknameDuplicated()
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
  @ApiOperation({
    summary: '닉네임 중복 확인 (공개)',
    description:
      '회원가입 전에 닉네임을 쓸 수 있는지 확인한다. 공개 API 라 토큰이 필요 없고, 쓸 수 있으면 available: true 다. ' +
      '5주차 명세 그대로 응답을 공통 틀로 감싸지 않는다.',
  })
  @ApiParam({
    name: 'nickname',
    example: '케빈',
    description: '확인할 닉네임 (2~12자)',
  })
  @ApiRawSuccess(200, '사용 가능 여부', { available: true })
  @ApiFailure(400, '닉네임 형식이 맞지 않음 (DB 를 보기 전에 거절)', {
    '닉네임 길이 오류': validationFailureBody(
      '닉네임은 2~12자로 입력해 주세요.',
    ),
  })
  checkNickname(
    @Param() { nickname }: NicknameParamDto,
  ): Promise<CheckResponseDto> {
    return this.memberService.checkNickname(nickname);
  }

  // GET /members/email/{email}
  @Get('email/:email')
  @ApiOperation({
    summary: '이메일 중복 확인 (공개)',
    description:
      '회원가입 전에 이메일을 쓸 수 있는지 확인한다. 공개 API 라 토큰이 필요 없고, 쓸 수 있으면 available: true 다. ' +
      '5주차 명세 그대로 응답을 공통 틀로 감싸지 않는다.',
  })
  @ApiParam({
    name: 'email',
    example: 'kevin@example.com',
    description: '확인할 이메일',
  })
  @ApiRawSuccess(200, '사용 가능 여부', { available: true })
  @ApiFailure(400, '이메일 형식이 맞지 않음 (DB 를 보기 전에 거절)', {
    '이메일 형식 오류':
      validationFailureBody('이메일 형식이 올바르지 않습니다.'),
  })
  checkEmail(@Param() { email }: EmailParamDto): Promise<CheckResponseDto> {
    return this.memberService.checkEmail(email);
  }

  // POST /members  → 201 { isSuccess, code, message, result: { memberId, email, nickname } }
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: '회원가입 (공개)',
    description:
      '이메일·비밀번호·닉네임으로 가입한다. 공개 API 라 토큰이 필요 없다. 비밀번호는 bcrypt 해시로만 저장되고 응답에는 나오지 않는다. ' +
      '이메일 중복은 MEMBER409_2, 닉네임 중복은 MEMBER409_1 로 구분한다.',
  })
  @ApiBody({
    type: CreateMemberDto,
    examples: {
      기본: {
        value: {
          email: 'kevin@example.com',
          password: 'Example-Password1!',
          nickname: '케빈',
        },
      },
    },
  })
  @ApiSuccess(201, '가입했다', 'COMMON201', '회원가입에 성공했습니다.', {
    memberId: 1,
    email: 'kevin@example.com',
    nickname: '케빈',
  })
  @ApiFailure(400, '입력 규칙을 통과하지 못함 (가입되지 않는다)', {
    '이메일 형식 오류': validationFailureBody('올바른 이메일 형식이 아닙니다.'),
    '비밀번호 규칙 오류': validationFailureBody(
      '비밀번호는 대문자/소문자/숫자/특수문자를 포함한 8자 이상이어야 합니다.',
    ),
    '모르는 필드': validationFailureBody('property role should not exist'),
  })
  @ApiSignUpDuplicated()
  async signUp(
    @Body() dto: CreateMemberDto,
  ): Promise<ApiResponse<MemberResponseDto>> {
    const result = await this.memberService.signUp(dto);
    return ApiResponse.success('COMMON201', '회원가입에 성공했습니다.', result);
  }
}
