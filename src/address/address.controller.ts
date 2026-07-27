import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AddressService } from './address.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user: { id: string };
}

@Controller('addresses')
@UseGuards(JwtAuthGuard)
export class AddressController {
  constructor(private readonly addressService: AddressService) {}

  // ── List all my addresses ─────────────────────────────────────────────────

  @Get()
  getUserAddresses(@Req() req: RequestWithUser) {
    return this.addressService.getUserAddresses(req.user.id);
  }

  // ── Get single address ────────────────────────────────────────────────────

  @Get(':id')
  getAddressById(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.addressService.getAddressById(id, req.user.id);
  }

  // ── Create address ────────────────────────────────────────────────────────

  @Post()
  createAddress(
    @Req() req: RequestWithUser,
    @Body() dto: CreateAddressDto,
  ) {
    return this.addressService.createAddress(req.user.id, dto);
  }

  // ── Update address ────────────────────────────────────────────────────────

  @Patch(':id')
  updateAddress(
    @Param('id') id: string,
    @Req() req: RequestWithUser,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.addressService.updateAddress(id, req.user.id, dto);
  }

  // ── Delete address ────────────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  deleteAddress(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.addressService.deleteAddress(id, req.user.id);
  }

  // ── Set as default ────────────────────────────────────────────────────────

  @Patch(':id/default')
  @HttpCode(HttpStatus.OK)
  setDefaultAddress(@Param('id') id: string, @Req() req: RequestWithUser) {
    return this.addressService.setDefaultAddress(id, req.user.id);
  }
}
