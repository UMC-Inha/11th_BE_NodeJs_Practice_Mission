// src/rental.controller.ts
import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { RentalService } from './rental.service.js';

@Controller('rentals') // 이 컨트롤러로 들어오는 기본 주소: /rentals
export class RentalController {
  constructor(private readonly rentalService: RentalService) {}

  // POST http://localhost:3000/rentals
  // Body: { "userId": 1, "bookId": 3 }
  @Post()
  async createRental(@Body() body: Record<string, any>): Promise<any> {
    return await this.rentalService.createRental(body);
  }

  // PATCH http://localhost:3000/rentals/1/return
  @Patch(':rentalId/return')
  async returnRental(
    @Param('rentalId', ParseIntPipe) rentalId: number,
  ): Promise<any> {
    return await this.rentalService.returnRental(rentalId);
  }
}
