import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { Book } from './book.entity.js';

@Entity('category')
export class Category {
  @PrimaryGeneratedColumn({ name: 'category_id', type: 'bigint' })
  categoryId: number;

  @Column({ type: 'varchar', length: 50 })
  name: string;

  @OneToMany(() => Book, (book) => book.category)
  books: Relation<Book[]>;
}