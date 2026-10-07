import { Body, Controller, Post } from '@nestjs/common';
import { RentalService } from './rental.service.js';

@Controller('rentals')
export class RentalController {
  constructor(private readonly rentalService: RentalService) {}

  @Post()
  async createRental(@Body() body: unknown) {
    return this.rentalService.createRental(body);
  }
}