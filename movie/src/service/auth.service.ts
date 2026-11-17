import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { LoginRequestDto } from '../dto/login-request.dto.js';
import { LoginResponseDto } from '../dto/login-response.dto.js';
import { Member } from '../entity/member.entity.js';
import { loginFailed } from '../exception/api.exception.js';
import { AccessTokenPayload } from '../guard/authenticated-request.js';

/**
 * 가입하지 않은 이메일로 로그인할 때도 bcrypt 비교를 한 번 하도록 쓰는 가짜 해시(cost 10, 어떤 비밀번호와도 맞지 않는 값).
 * 이게 없으면 "없는 이메일"이 "틀린 비밀번호"보다 0.1초 넘게 빨리 응답해서, 응답 시간만으로 가입 여부를 알 수 있다.
 */
const TIMING_EQUALIZER_HASH =
  '$2b$10$XkyjewyrkuME5yZr1Ht43eofEIboO8HpbBHMKTEUq79U7aSCwoOde';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Member)
    private readonly memberRepository: Repository<Member>,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * 1) 이메일로 회원 찾기  2) 입력한 비밀번호를 저장된 해시와 비교  3) 통과하면 토큰 발급
   * 1)·2) 어디에서 실패해도 똑같은 loginFailed() 를 던진다.
   */
  async login(dto: LoginRequestDto): Promise<LoginResponseDto> {
    const member = await this.memberRepository.findOne({
      where: { email: dto.email },
    });

    // compare() 는 저장된 해시에서 salt 를 꺼내 같은 방식으로 해시한 뒤 결과끼리 비교한다.
    const matched = await bcrypt.compare(
      dto.password,
      member?.password ?? TIMING_EQUALIZER_HASH,
    );
    if (!member || !matched) {
      throw loginFailed();
    }

    // payload 는 암호화가 아니라 인코딩이라 누구나 읽을 수 있다. 비밀번호 같은 값은 절대 넣지 않는다.
    const payload: AccessTokenPayload = {
      sub: String(member.memberId),
      email: member.email,
    };
    return {
      nickname: member.nickname,
      accessToken: await this.jwtService.signAsync(payload),
    };
  }
}
