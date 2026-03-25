import { Controller, Get, Param, UseGuards, Req } from '@nestjs/common';
import { AddressService } from './address.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user: { id: string };
}

@Controller('addresses')
@UseGuards(JwtAuthGuard)
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  @Get()
  async getUserAddresses(@Req() req: RequestWithUser) {
    return this.addressService.getUserAddresses(req.user.id);
  }

  @Get(':id')
  async getAddressById(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.addressService.getAddressById(id, req.user.id);
  }
}
