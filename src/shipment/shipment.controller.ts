import {
  Controller,
  Post,
  Body,
  Param,
  Get,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ShipmentService } from './shipment.service';
import { CreateShipmentDto } from './dto/create-shipment.dto';
import { AddTrackingEventDto } from './dto/add-tracking-event.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, Role } from '../common/decorators/roles.decorator';
import { ResponseMessage } from '../common/interceptors/transform.interceptor';

@Controller('shipments')
@UseGuards(JwtAuthGuard)
export class ShipmentController {
  constructor(private readonly shipmentService: ShipmentService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ResponseMessage('Shipment created successfully')
  async createShipment(@Req() req: any, @Body() dto: CreateShipmentDto) {
    return this.shipmentService.createShipment(req.user.id, dto);
  }

  @Post(':id/events')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ResponseMessage('Tracking event added successfully')
  async addTrackingEvent(
    @Req() req: any,
    @Param('id') shipmentId: string,
    @Body() dto: AddTrackingEventDto,
  ) {
    return this.shipmentService.addTrackingEvent(req.user.id, shipmentId, dto);
  }

  @Get('order/:orderId')
  @ResponseMessage('Shipment tracking retrieved successfully')
  async getShipmentTracking(@Param('orderId') orderId: string) {
    // Note: If you want customers to only view their own shipments,
    // you would verify req.user.id == order.userId here, but we will leave it open
    // assuming they need the order ID and must be authenticated.
    return this.shipmentService.getShipmentTracking(orderId);
  }
}
