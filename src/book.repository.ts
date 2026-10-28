// src/book.repository.ts
import { Injectable, Inject } from '@nestjs/common';
import type { Pool } from 'mysql2/promise';
import { DATABASE_CONNECTION } from './database.provider.js';

@Injectable() // NestJS 컨테이너에 "나 주입 가능한 부품이야!"라고 등록
export class BookRepository {
  constructor(
    // 2단계에서 우리가 등록해둔 DB 커넥션 풀(DATABASE_CONNECTION)을 가져옵니다.
    @Inject(DATABASE_CONNECTION) private readonly pool: Pool,
  ) {}

  async findByCategoryId(categoryId: number): Promise<any> {
    const sql = 'SELECT * FROM book WHERE category_id = ?';
    const [rows] = await this.pool.execute(sql, [categoryId]);
    return rows;
  }

  async findAll(): Promise<any> {
    const sql = 'SELECT * FROM book';

    const [rows] = await this.pool.query(sql);
    return rows;
  }

  async create(body: Record<string, any>): Promise<any> {
    const sql =
      'INSERT INTO book (category_id, title, description, is_available) VALUES (?, ?, ?, true)';

    const [result] = await this.pool.execute(sql, [
      body.categoryId,
      body.title,
      body.description ?? null,
    ]);
    return result;
  }
}