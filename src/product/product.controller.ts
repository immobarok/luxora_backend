// src/product/controllers/product.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Req,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CreateProductDto } from './dto/create-product.dto';
import { ProductListQueryDto as ProductListQuery } from './dto/product-list-query.dto';
import { UpdateProductDto as UpdateProduct } from './dto/update-product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, Role } from '../common/decorators/roles.decorator';
import type { Request } from 'express';
import { MediaService } from '../media/media.service';
import type { UploadedFile as UploadedFileType } from '../media/types/uploaded-file.type';
import { ProductService } from './product.service';

interface AuthenticatedRequest extends Request {
  user: {
    userId: string;
  };
}

@Controller('products')
export class ProductController {
  constructor(
    private readonly productService: ProductService,
    private readonly mediaService: MediaService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @UseInterceptors(FilesInterceptor('files', 10))
  async create(
    @Body() dto: CreateProductDto,
    @UploadedFiles() files: UploadedFileType[],
    @Req() req: AuthenticatedRequest,
  ) {
    const adminId = req.user['userId'];

    let mediaIds: string[] = dto.mediaIds || [];

    if (files?.length) {
      const uploaded = await this.mediaService.uploadMultiple(files, adminId, {
        folder: 'products',
      });
      mediaIds = [...mediaIds, ...uploaded.map((m) => m.id)];
    }

    return this.productService.create(adminId, {
      ...dto,
      mediaIds,
    });
  }

  @Get()
  async findAll(@Query() query: ProductListQuery) {
    return this.productService.findAll(query);
  }

  @Get('featured')
  async findFeatured() {
    return this.productService.findFeatured();
  }

  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.productService.findBySlug(slug);
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.productService.findById(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @UseInterceptors(FilesInterceptor('files', 10))
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProduct,
    @UploadedFiles() files: UploadedFileType[],
    @Req() req: AuthenticatedRequest,
  ) {
    const adminId = req.user['userId'];

    let mediaIds: string[] = dto.mediaIds || [];

    if (files?.length) {
      const uploaded = await this.mediaService.uploadMultiple(files, adminId, {
        folder: 'products',
      });
      mediaIds = [...mediaIds, ...uploaded.map((m) => m.id)];
    }

    return this.productService.update(id, adminId, {
      ...dto,
      mediaIds: mediaIds.length ? mediaIds : undefined,
    });
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.productService.publish(id, req.user['userId']);
  }

  @Post(':id/unpublish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async unpublish(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.productService.unpublish(id, req.user['userId']);
  }

  @Post(':id/variants/:variantId/stock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.OK)
  async updateStock(
    @Param('id', ParseUUIDPipe) _id: string,
    @Param('variantId', ParseUUIDPipe) variantId: string,
    @Body() dto: { quantity: number; reason: string },
  ) {
    await this.productService.updateStock(variantId, dto.quantity, dto.reason);
    return { message: 'Stock updated successfully' };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.productService.remove(id, req.user['userId'], false);
  }

  @Delete(':id/permanent')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async removePermanent(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.productService.remove(id, req.user['userId'], true);
  }
}
