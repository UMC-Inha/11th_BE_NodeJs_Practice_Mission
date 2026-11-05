import { Member } from '../entity/member.entity.js';

/**
 * 회원가입 성공 응답의 result.
 * Entity 를 그대로 내보내면 password(bcrypt 해시)까지 나가므로, 필드를 하나씩 옮긴다.
 */
export class MemberResponseDto {
  memberId: number;
  email: string;
  nickname: string;

  static from(member: Member): MemberResponseDto {
    return {
      memberId: member.memberId,
      email: member.email,
      nickname: member.nickname,
    };
  }
}
