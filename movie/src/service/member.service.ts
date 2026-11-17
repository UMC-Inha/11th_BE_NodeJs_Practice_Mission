import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcrypt';
import { Not, Repository } from 'typeorm';
import { CheckResponseDto } from '../dto/check-response.dto.js';
import { CreateMemberDto } from '../dto/create-member.dto.js';
import { MemberInfoResponseDto } from '../dto/member-info-response.dto.js';
import { MemberResponseDto } from '../dto/member-response.dto.js';
import { MemberUpdateRequestDto } from '../dto/member-update-request.dto.js';
import { Member } from '../entity/member.entity.js';
import {
  emailDuplicated,
  memberNotFound,
  nicknameDuplicated,
} from '../exception/api.exception.js';

/** bcrypt cost(salt round). 워크북 기본값 10 은 이 Mac 에서 한 번 해시하는 데 약 0.17초. 1 올릴 때마다 2배. */
export const BCRYPT_SALT_ROUNDS = 10;

@Injectable()
export class MemberService {
  constructor(
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
  ) {}

  async checkNickname(nickname: string): Promise<CheckResponseDto> {
    const exists = await this.memberRepository.exists({ where: { nickname } });
    return CheckResponseDto.of(exists);
  }

  async checkEmail(email: string): Promise<CheckResponseDto> {
    const exists = await this.memberRepository.exists({ where: { email } });
    return CheckResponseDto.of(exists);
  }

  /**
   * 1) 이메일·닉네임 사전 중복 확인  2) bcrypt 해시  3) 저장  4) 비밀번호 뺀 응답
   *
   * 1)을 통과해도 동시에 같은 값이 들어오면 3)에서 DB UNIQUE 가 막는다.
   * 그 오류(ER_DUP_ENTRY)는 AllExceptionsFilter 가 같은 409 응답으로 바꿔 준다.
   */
  async signUp(dto: CreateMemberDto): Promise<MemberResponseDto> {
    if (await this.memberRepository.exists({ where: { email: dto.email } })) {
      throw emailDuplicated();
    }
    if (
      await this.memberRepository.exists({ where: { nickname: dto.nickname } })
    ) {
      throw nicknameDuplicated();
    }

    const saved = await this.memberRepository.save(
      this.memberRepository.create({
        email: dto.email,
        password: await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS),
        nickname: dto.nickname,
      }),
    );

    return MemberResponseDto.from(saved);
  }

  /** 토큰이 알려 준 회원 본인의 정보. password 는 DTO 에서 빠진다. */
  async getMyInfo(memberId: number): Promise<MemberInfoResponseDto> {
    const member = await this.memberRepository.findOneBy({ memberId });
    if (!member) {
      // 토큰은 멀쩡한데 그 사이 탈퇴(삭제)한 경우
      throw memberNotFound();
    }
    return MemberInfoResponseDto.from(member);
  }

  /**
   * 닉네임 변경. 내가 지금 쓰는 닉네임은 중복이 아니므로 "나를 제외한" 회원 중에서 찾는다.
   * 동시에 같은 닉네임으로 바꾸는 요청은 DB UNIQUE 가 막고, 필터가 같은 409 로 바꿔 준다.
   */
  async updateMyInfo(
    memberId: number,
    dto: MemberUpdateRequestDto,
  ): Promise<MemberInfoResponseDto> {
    const member = await this.memberRepository.findOneBy({ memberId });
    if (!member) {
      throw memberNotFound();
    }

    const taken = await this.memberRepository.exists({
      where: { nickname: dto.nickname, memberId: Not(memberId) },
    });
    if (taken) {
      throw nicknameDuplicated();
    }

    member.nickname = dto.nickname;
    return MemberInfoResponseDto.from(await this.memberRepository.save(member));
  }
}
