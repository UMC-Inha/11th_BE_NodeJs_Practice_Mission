// src/rental.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { RentalRepository } from './rental.repository.js';

@Injectable()
export class RentalService {
  constructor(private readonly rentalRepository: RentalRepository) {}

  async createRental(body: Record<string, any>): Promise<any> {
    const result = await this.rentalRepository.create(body);

    // INSERT 결과에는 새로 붙은 번호(insertId)만 들어 있습니다.
    // 대여일·반납 예정일이 제대로 들어갔는지 보여 주려고 방금 만든 행을 다시 읽어 옵니다.
    const [rental] = await this.rentalRepository.findById(result.insertId);
    return rental;
  }

  async returnRental(rentalId: number): Promise<any> {
    const result = await this.rentalRepository.markReturned(rentalId);

    // UPDATE는 조건에 맞는 행이 없어도 에러 없이 끝납니다(affectedRows = 0).
    // 없는 번호이거나 이미 반납한 기록이면 200 대신 404로 알려 줍니다.
    if (result.affectedRows === 0) {
      throw new NotFoundException(
        `반납할 수 있는 대여 기록이 없습니다. (rentalId: ${rentalId}, 없는 번호이거나 이미 반납됨)`,
      );
    }

    const [rental] = await this.rentalRepository.findById(rentalId);
    return rental;
  }
}
