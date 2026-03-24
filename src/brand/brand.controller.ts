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
} from '@nestjs/common';
import { BrandService } from './brand.service';
import { JwtAuthGuard } from 'src/auth/guards/jwt-auth.guard';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { Public, Role, Roles } from 'src/common/decorators';
import { CreateBrandDto, UpdateBrandDto } from './dto';
import { ResponseMessage } from 'src/common/interceptors';

@Controller('brands')
export class BrandController {
  constructor(private readonly brandService: BrandService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ResponseMessage('Brand created successfully')
  async create(@Body() dto: CreateBrandDto) {
    return this.brandService.create(dto);
  }

  @Get()
  @Public()
  @ResponseMessage('Brands retrieved successfully')
  async findAll(
    @Query('search') search?: string,
    @Query('isVerified') isVerified?: string,
  ) {
    return this.brandService.findAll({
      search,
      isVerified: isVerified === 'true' ? true : undefined,
    });
  }

  @Get(':id')
  @ResponseMessage('Brand retrieved successfully')
  async findById(@Param('id') id: string) {
    return this.brandService.findById(id);
  }

  @Get('slug/:slug')
  @ResponseMessage('Brand retrieved successfully')
  async findBySlug(@Param('slug') slug: string) {
    return this.brandService.findBySlug(slug);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @ResponseMessage('Brand updated successfully')
  async update(@Param('id') id: string, @Body() dto: UpdateBrandDto) {
    return this.brandService.update(id, dto);
  }

  @Post(':id/verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  @ResponseMessage('Brand verified successfully')
  async verify(@Param('id') id: string) {
    return this.brandService.verify(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseMessage('Brand deleted successfully')
  async remove(@Param('id') id: string) {
    await this.brandService.remove(id);
  }
}
