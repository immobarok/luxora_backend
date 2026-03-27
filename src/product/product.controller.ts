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
import { ResponseMessage } from 'src/common/interceptors';
import { Public } from 'src/common/decorators';

interface AuthenticatedRequest extends Request {
  user: {
    id: string;
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
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseInterceptors(FilesInterceptor('files', 10))
  @ResponseMessage('Product created successfully')
  async create(
    @Body() dto: CreateProductDto,
    @UploadedFiles() files: UploadedFileType[],
    @Req() req: AuthenticatedRequest,
  ) {
    const adminId = req.user.id;

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
  @Public()
  @ResponseMessage('Products retrieved successfully')
  async findAll(@Query() query: ProductListQuery) {
    return this.productService.findAll(query);
  }

  @Get('featured')
  @Public()
  @ResponseMessage('Featured products retrieved successfully')
  async findFeatured() {
    return this.productService.findFeatured();
  }

  @Get('slug/:slug')
  @Public()
  @ResponseMessage('Product retrieved successfully')
  async findBySlug(@Param('slug') slug: string) {
    return this.productService.findBySlug(slug);
  }

  @Get(':id')
  @ResponseMessage('Product retrieved successfully')
  async findById(@Param('id') id: string) {
    return this.productService.findById(id);
  }

  @Patch(':id')
  @ResponseMessage('Product updated successfully')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @UseInterceptors(FilesInterceptor('files', 10))
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProduct,
    @UploadedFiles() files: UploadedFileType[],
    @Req() req: AuthenticatedRequest,
  ) {
    const adminId = req.user.id;

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
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Product published successfully')
  async publish(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.productService.publish(id, req.user.id);
  }

  @Post(':id/unpublish')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Product unpublished successfully')
  async unpublish(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.productService.unpublish(id, req.user.id);
  }

  @Post(':id/variants/:variantId/stock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage('Stock updated successfully')
  async updateStock(
    @Param('id') _id: string,
    @Param('variantId') variantId: string,
    @Body() dto: { quantity: number; reason: string },
  ) {
    await this.productService.updateStock(variantId, dto.quantity, dto.reason);
    return { message: 'Stock updated successfully' };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseMessage('Product removed successfully')
  async remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    await this.productService.remove(id, req.user.id, false);
  }

  @Delete(':id/permanent')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseMessage('Product permanently removed successfully')
  async removePermanent(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.productService.remove(id, req.user.id, true);
  }
}
