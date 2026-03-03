import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  ParseIntPipe,
  DefaultValuePipe,
  Req,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';

import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { ParseCuidPipe } from 'src/common/pipes/parse-cuid.pipe';
import { MediaCategory } from '@prisma/client';
import { MediaService } from './media.service';
import type { UploadFileDto } from './media.service';
import type { UploadedFile as UploadedFileType } from './types/uploaded-file.type';
import type { Request } from 'express';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
  };
}

@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  constructor(private readonly mediaService: MediaService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSingle(
    @UploadedFile() file: UploadedFileType,
    @Body() dto: UploadFileDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.mediaService.uploadSingle(file, req.user.userId, dto);
  }

  @Post('upload-multiple')
  @UseInterceptors(FilesInterceptor('files', 10))
  async uploadMultiple(
    @UploadedFiles() files: UploadedFileType[],
    @Body() dto: UploadFileDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.mediaService.uploadMultiple(files, req.user.userId, dto);
  }

  @Get()
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Req() req: AuthenticatedRequest,
    @Query('category') category?: MediaCategory,
  ) {
    return this.mediaService.findByUser(req.user.userId, {
      category,
      page,
      limit,
    });
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseCuidPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.mediaService.findById(id, req.user.userId);
  }

  @Patch(':id')
  @UseInterceptors(FileInterceptor('file'))
  async update(
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: { alt?: string },
    @UploadedFile() file: UploadedFileType,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.mediaService.update(id, req.user.userId, {
      alt: dto.alt,
      file,
    });
  }

  @Delete(':id')
  async delete(
    @Param('id', ParseCuidPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.mediaService.delete(id, req.user.userId);
    return { message: 'Deleted successfully' };
  }

  @Delete('bulk/delete')
  async deleteMany(
    @Body() dto: { ids: string[] },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.mediaService.deleteMany(dto.ids, req.user.userId);
  }
}
