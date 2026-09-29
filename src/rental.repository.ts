// src/rental.repository.ts
import { Injectable, Inject } from '@nestjs/common';
import type { Pool } from 'mysql2/promise';
import { DATABASE_CONNECTION } from './database.provider.js';

@Injectable()
export class RentalRepository {
  constructor(@Inject(DATABASE_CONNECTION) private readonly pool: Pool) {}

  // [미션 2] POST /rentals
  async create(body: Record<string, any>): Promise<any> {
    // rental_id는 AUTO_INCREMENT라 생략, returned_at은 NULL 허용이라 생략(아직 반납 전)
    // 대여일은 지금(NOW()), 반납 예정일은 7일 뒤(DATE_ADD)로 DB가 직접 계산합니다.
    const sql =
      'INSERT INTO rental (user_id, book_id, rented_at, due_at) VALUES (?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY))';

    const [result] = await this.pool.execute(sql, [body.userId, body.bookId]);
    return result;
  }

  async findById(rentalId: number): Promise<any> {
    const sql = 'SELECT * FROM rental WHERE rental_id = ?';

    const [rows] = await this.pool.execute(sql, [rentalId]);
    return rows;
  }

  // [선택 미션] PATCH /rentals/{rentalId}/return
  async markReturned(rentalId: number): Promise<any> {
    const sql = 'UPDATE rental SET returned_at = NOW() WHERE rental_id = ?';

    const [result] = await this.pool.execute(sql, [rentalId]);
    return result;
  }
}
