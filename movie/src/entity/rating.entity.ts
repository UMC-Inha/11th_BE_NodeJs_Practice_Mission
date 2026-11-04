import {
  Column,
  Unique,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { BaseTimeEntity } from "./base-time.entity.js";
import { Member } from "./member.entity.js";

@Entity("rating")
@Unique("uk_rating_member_movie", ["member", "movieId"])
export class Rating extends BaseTimeEntity {
  @PrimaryGeneratedColumn({ name: "rating_id", type: "bigint" })
  ratingId: number;

  @ManyToOne(() => Member, { nullable: false })
  @JoinColumn({ name: "member_id" })
  member: Member;

  @Column({ name: "movie_id", type: "bigint" })
  movieId: number;

  @Column({ type: "tinyint" })
  score: number;

  @Column({ type: "text", nullable: true })
  comment: string | null;
}