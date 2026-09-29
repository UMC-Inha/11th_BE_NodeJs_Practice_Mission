// src/rental.service.ts
import { Injectable } from '@nestjs/common';
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
    await this.rentalRepository.markReturned(rentalId);

    const [rental] = await this.rentalRepository.findById(rentalId);
    return rental;
  }
}
