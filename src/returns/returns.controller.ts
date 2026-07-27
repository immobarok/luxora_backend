import { Controller, Get, Post, Body, Patch, Param, UseGuards, Req } from '@nestjs/common';
import { ReturnsService } from './returns.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { UpdateReturnStatusDto } from './dto/update-return.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, Role } from '../common/decorators/roles.decorator';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

@Controller('returns')
export class ReturnsController {
  constructor(private readonly returnsService: ReturnsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createRequest(
    @Req() req: RequestWithUser,
    @Body() dto: CreateReturnDto,
  ) {
    const returnReq = await this.returnsService.createReturnRequest(req.user.id, dto);
    return {
      success: true,
      message: 'Return request submitted successfully',
      data: returnReq,
    };
  }

  @Get('my-returns')
  @UseGuards(JwtAuthGuard)
  async getMyReturns(@Req() req: RequestWithUser) {
    const returns = await this.returnsService.getMyReturns(req.user.id);
    return {
      success: true,
      message: 'Your returns fetched successfully',
      data: returns,
    };
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async getAllReturns() {
    const returns = await this.returnsService.getAllReturns();
    return {
      success: true,
      message: 'All returns fetched successfully',
      data: returns,
    };
  }

  @Patch('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async updateReturnStatus(
    @Param('id') id: string,
    @Body() dto: UpdateReturnStatusDto,
  ) {
    const updated = await this.returnsService.updateReturnStatus(id, dto);
    return {
      success: true,
      message: 'Return status updated successfully',
      data: updated,
    };
  }
}
