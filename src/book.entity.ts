import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Category } from './category.entity.js';
@Entity('book')
@Index('uq_book_title', ['title'], { unique: true })
export class Book {
  // MySQL BIGINT는 정밀도를 잃지 않도록 문자열로 다룬다.
  @PrimaryGeneratedColumn({ name: 'book_id', type: 'bigint' })
  bookId: string;
  @ManyToOne(() => Category, (category) => category.books, { nullable: false })
  @JoinColumn({ name: 'category_id' })
  category: Category;
  @Column({ type: 'varchar', length: 100 })
  title: string;
  @Column({ type: 'text', nullable: true })
  description: string | null;
  @Column({ name: 'is_available', type: 'boolean', default: true })
  isAvailable: boolean;
}
