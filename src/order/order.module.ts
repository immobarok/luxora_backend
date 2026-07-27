import { Module } from '@nestjs/common';
import { OrderService } from './order.service';
import { OrderController } from './order.controller';
import { CheckoutService } from './checkout.service';
import { CartModule } from '../cart/cart.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [CartModule, PrismaModule, MailModule],
  controllers: [OrderController],
  providers: [OrderService, CheckoutService],
  exports: [OrderService],
})
export class OrderModule {}
