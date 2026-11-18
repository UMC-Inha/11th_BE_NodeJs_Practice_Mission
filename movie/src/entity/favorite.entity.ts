import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { BaseTimeEntity } from './base-time.entity.js';
import { Member } from './member.entity.js';

/**
 * 즐겨찾기는 영화의 속성이 아니라 "회원과 영화의 관계"다.
 * 어떤 회원에게는 좋아하는 영화여도 다른 회원에게는 아닐 수 있어서 Member 와 movieId 가 함께 들어간다.
 */
@Entity('favorite')
// 같은 회원이 같은 영화를 두 번 즐겨찾기하지 못하게 하는 복합 UNIQUE (스키마의 uk_favorite_member_movie).
// movie_id 만 UNIQUE 이면 한 영화가 서비스 전체에서 한 번만 즐겨찾기될 수 있으니 반드시 두 값을 한 쌍으로 묶는다.
@Unique('uk_favorite_member_movie', ['member', 'movieId'])
export class Favorite extends BaseTimeEntity {
  @PrimaryGeneratedColumn({ name: 'favorite_id', type: 'bigint' })
  favoriteId: number;

  // 즐겨찾기의 주인은 로그인한 회원이다(토큰에서 나온 memberId).
  @ManyToOne(() => Member, { nullable: false })
  @JoinColumn({ name: 'member_id' })
  member: Member;

  // TMDB 가 부여한 영화 ID. 우리 DB 에 movie 테이블이 없으므로 외래 키가 아니다.
  @Column({ name: 'movie_id', type: 'bigint' })
  movieId: number;
}
