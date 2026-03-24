import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { MediaModule } from '../media/media.module';
import { CategoryController } from './category.controller';
import { CategoryService } from './category.service';

@Module({
  imports: [PrismaModule, MediaModule],
  controllers: [CategoryController],
  providers: [CategoryService],
  exports: [CategoryService],
})
export class CategoryModule {}
