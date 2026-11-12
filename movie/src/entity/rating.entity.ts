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

@Entity('rating')
// 같은 회원이 같은 영화에 평점을 두 번 남기지 못하게 하는 복합 UNIQUE (스키마의 uk_rating_member_movie)
@Unique('uk_rating_member_movie', ['member', 'movieId'])
export class Rating extends BaseTimeEntity {
  @PrimaryGeneratedColumn({ name: 'rating_id', type: 'bigint' })
  ratingId: number;

  // Member 1 : N Rating
  @ManyToOne(() => Member, { nullable: false })
  @JoinColumn({ name: 'member_id' })
  member: Member;

  // TMDB 영화 ID. 우리 DB에 영화 테이블이 없으므로 FK가 아닌 일반 컬럼이다.
  @Column({ name: 'movie_id', type: 'bigint' })
  movieId: number;

  // 1~5점
  @Column({ type: 'tinyint' })
  score: number;

  @Column({ type: 'text', nullable: true })
  comment: string | null;
}
