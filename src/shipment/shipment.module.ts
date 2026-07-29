import { Module } from '@nestjs/common';
import { ShipmentService } from './shipment.service';
import { ShipmentController } from './shipment.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminActionModule } from '../admin-action/admin-action.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [PrismaModule, AdminActionModule, MailModule],
  controllers: [ShipmentController],
  providers: [ShipmentService],
})
export class ShipmentModule {}
