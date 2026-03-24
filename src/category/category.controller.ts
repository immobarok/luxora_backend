import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request } from 'express';
import { CategoryService } from './category.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Roles, Role } from '../common/decorators/roles.decorator';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Public } from 'src/common/decorators';
import { MediaService } from 'src/media/media.service';
import type { UploadedFile as UploadedFileType } from 'src/media/types/uploaded-file.type';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
  };
}

@Controller('categories')
export class CategoryController {
  constructor(
    private readonly categoryService: CategoryService,
    private readonly mediaService: MediaService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @Body() dto: CreateCategoryDto,
    @UploadedFile() file: UploadedFileType,
    @Req() req: AuthenticatedRequest,
  ) {
    if (file) {
      const uploaded = await this.mediaService.uploadSingle(file, req.user.id, {
        folder: 'categories',
        alt: dto.name,
      });
      dto.imageUrl = uploaded.url;
    }

    return this.categoryService.create(dto);
  }

  @Get()
  @Public()
  async findAll() {
    return this.categoryService.findAll();
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.categoryService.findById(id);
  }

  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.categoryService.findBySlug(slug);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @UploadedFile() file: UploadedFileType,
    @Req() req: AuthenticatedRequest,
  ) {
    if (file) {
      const uploaded = await this.mediaService.uploadSingle(file, req.user.id, {
        folder: 'categories',
        alt: dto.name,
      });
      dto.imageUrl = uploaded.url;
    }

    return this.categoryService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string) {
    await this.categoryService.remove(id);
  }
}
