import { Member } from '../entity/member.entity.js';

/** GET·PATCH /members/me 응답의 result. 엔티티를 그대로 내보내면 password 까지 나가므로 필드를 옮겨 담는다. */
export class MemberInfoResponseDto {
  email: string;
  nickname: string;
  createdAt: Date;

  static from(member: Member): MemberInfoResponseDto {
    return {
      email: member.email,
      nickname: member.nickname,
      createdAt: member.createdAt,
    };
  }
}
