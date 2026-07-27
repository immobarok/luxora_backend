import { Module } from '@nestjs/common';
import { AdminActionService } from './admin-action.service';
import { AdminActionController } from './admin-action.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AdminActionController],
  providers: [AdminActionService],
  exports: [AdminActionService],
})
export class AdminActionModule {}
