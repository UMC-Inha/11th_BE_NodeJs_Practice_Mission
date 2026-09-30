import { Injectable, Inject } from '@nestjs/common';
import type { Pool } from 'mysql2/promise';
import { DATABASE_CONNECTION } from './database.provider.js';

@Injectable()
export class RentalRepository {
  constructor(
    @Inject(DATABASE_CONNECTION) private readonly pool: Pool,
  ) {}

  async create(body: Record<string, any>): Promise<any> {
    // rental_id는 AUTO_INCREMENT, returned_at은 대여 시점엔 NULL이므로 생략
    const sql =
      'INSERT INTO rental (user_id, book_id, rented_at, due_at) VALUES (?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY))';

    const [result] = await this.pool.execute(sql, [body.userId, body.bookId]);
    return result;
  }
}