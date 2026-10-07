import { BadRequestException, Injectable } from '@nestjs/common';
import { RentalRepository } from './rental.repository.js';

@Injectable()
export class RentalService {
  constructor(private readonly rentalRepository: RentalRepository) {}

  async createRental(body: unknown) {
    if (typeof body !== 'object' || body === null || Array.isArray(body)) {
      throw new BadRequestException('userId와 bookId를 전달해 주세요.');
    }
    const { userId, bookId } = body as Record<string, unknown>;
    if (
      typeof userId !== 'number' || !Number.isSafeInteger(userId) || userId <= 0 ||
      typeof bookId !== 'number' || !Number.isSafeInteger(bookId) || bookId <= 0
    ) {
      throw new BadRequestException('userId와 bookId는 양의 정수여야 합니다.');
    }

    const result = await this.rentalRepository.create(userId, bookId);
    return { rentalId: result.insertId, userId, bookId };
  }
}