import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import mediaConfig from '../config/media.config';

import { FileValidatorService } from './services/file-validator.service';
import { PathGeneratorService } from './services/path-generator.service';
import { MinioProvider } from './providers/minio.provider';
import { STORAGE_PROVIDER } from './providers/storage.interface';
import { PrismaModule } from '../prisma/prisma.module';
import { MediaController } from './media.controller';
import { MediaService } from './media.service';

@Module({
  imports: [ConfigModule.forFeature(mediaConfig), PrismaModule],
  controllers: [MediaController],
  providers: [
    MediaService,
    FileValidatorService,
    PathGeneratorService,
    {
      provide: STORAGE_PROVIDER,
      useClass: MinioProvider,
    },
  ],
  exports: [MediaService],
})
export class MediaModule {}
