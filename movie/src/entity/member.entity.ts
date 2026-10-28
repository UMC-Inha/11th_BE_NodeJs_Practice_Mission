import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { BaseTimeEntity } from './base-time.entity.js';

@Entity('member')
export class Member extends BaseTimeEntity {
  @PrimaryGeneratedColumn({ name: 'member_id', type: 'bigint' })
  memberId: number;

  // RFC 5321 이메일 주소 최대 길이
  @Column({ unique: true, length: 254 })
  email: string;

  // 6주차부터 bcrypt 해시(항상 60자)가 저장된다. 응답 DTO에는 절대 넣지 않는다.
  @Column({ length: 60 })
  password: string;

  @Column({ unique: true, length: 50 })
  nickname: string;
}
