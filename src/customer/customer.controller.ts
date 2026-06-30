import {
  Controller,
  Get,
  Param,
  Delete,
  Query,
  UseGuards,
  Res,
} from '@nestjs/common';
import { CustomerService } from './customer.service';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, Role } from '../common/decorators/roles.decorator';
import type { Response } from 'express';

@Controller('customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.SUPER_ADMIN)
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  findAll(@Query() query: CustomerQueryDto) {
    return this.customerService.findAll(query);
  }

  @Get('stats')
  getStats() {
    return this.customerService.getStats();
  }

  @Get('export')
  async exportCustomers(@Res() res: Response) {
    const csvContent = await this.customerService.exportCustomers();
    res.header('Content-Type', 'text/csv');
    res.attachment('customers-export.csv');
    return res.send(csvContent);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.customerService.findOne(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.customerService.remove(id);
  }
}
