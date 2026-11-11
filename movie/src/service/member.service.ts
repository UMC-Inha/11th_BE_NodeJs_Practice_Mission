import { ConflictException, Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import * as bcrypt from "bcrypt";
import { Member } from "../entity/member.entity";
import { CheckResponseDto } from "../dto/check-response.dto";
import { CreateMemberDto } from "../dto/create-member.dto";

const SALT_ROUNDS = 10;

@Injectable()
export class MemberService {
  constructor(
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
  ) {}

  async checkNickname(nickname: string): Promise<CheckResponseDto> {
    const exists = await this.memberRepository.exists({ where: { nickname } });
    return { available: !exists };
  }

  async checkEmail(email: string): Promise<CheckResponseDto> {
    const exists = await this.memberRepository.exists({ where: { email } });
    return { available: !exists };
  }

  async signUp(dto: CreateMemberDto) {
    // 1. 이메일과 닉네임이 이미 있는지 확인해요.
    const existingEmail = await this.memberRepository.findOneBy({
      email: dto.email,
    });
    if (existingEmail) {
      throw new ConflictException("이미 사용 중인 이메일입니다.");
    }

    const existingNickname = await this.memberRepository.findOneBy({
      nickname: dto.nickname,
    });
    if (existingNickname) {
      throw new ConflictException("이미 사용 중인 닉네임입니다.");
    }

    // 2. 비밀번호를 bcrypt로 해시해요. 평문은 저장하지 않아요.
    const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);

    // 3. 저장해요.
    const savedMember = await this.memberRepository.save(
      this.memberRepository.create({
        email: dto.email,
        password: hashedPassword,
        nickname: dto.nickname,
      }),
    );

    // 4. password를 제외한 값만 반환해요.
    return {
      memberId: savedMember.memberId,
      email: savedMember.email,
      nickname: savedMember.nickname,
    };
  }
}