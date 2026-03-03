import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateBrandDto, UpdateBrandDto } from './dto';
import { BrandEntity } from './entity';

@Injectable()
export class BrandService {
  private readonly logger = new Logger(BrandService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateBrandDto): Promise<BrandEntity> {
    this.logger.log(`Creating brand: ${dto.name}`);

    // Check slug uniqueness
    const existing = await this.prisma.brand.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException(
        `Brand with slug "${dto.slug}" already exists`,
      );
    }

    const brand = await this.prisma.brand.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        logoUrl: dto.logoUrl,
        website: dto.website,
        isVerified: dto.isVerified ?? false,
      },
    });

    this.logger.log(`Brand created: ${brand.id}`);

    return new BrandEntity(brand);
  }

  async findAll(query?: {
    search?: string;
    isVerified?: boolean;
  }): Promise<BrandEntity[]> {
    const where: Record<string, any> = {};

    if (query?.search) {
      where.name = { contains: query.search, mode: 'insensitive' };
    }

    if (query?.isVerified !== undefined) {
      where.isVerified = query.isVerified;
    }

    const brands = await this.prisma.brand.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return brands.map((b) => new BrandEntity(b));
  }

  async findById(id: string): Promise<BrandEntity> {
    const brand = await this.prisma.brand.findUnique({
      where: { id },
    });

    if (!brand) {
      throw new NotFoundException(`Brand with ID "${id}" not found`);
    }

    return new BrandEntity(brand);
  }

  async findBySlug(slug: string): Promise<BrandEntity> {
    const brand = await this.prisma.brand.findUnique({
      where: { slug },
    });

    if (!brand) {
      throw new NotFoundException(`Brand with slug "${slug}" not found`);
    }

    return new BrandEntity(brand);
  }

  async update(id: string, dto: UpdateBrandDto): Promise<BrandEntity> {
    this.logger.log(`Updating brand: ${id}`);

    const existing = await this.prisma.brand.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Brand with ID "${id}" not found`);
    }

    // Check slug uniqueness if changing
    if (dto.slug && dto.slug !== existing.slug) {
      const slugExists = await this.prisma.brand.findUnique({
        where: { slug: dto.slug },
      });
      if (slugExists) {
        throw new ConflictException(`Slug "${dto.slug}" already in use`);
      }
    }

    const updated = await this.prisma.brand.update({
      where: { id },
      data: dto,
    });

    this.logger.log(`Brand updated: ${id}`);

    return new BrandEntity(updated);
  }

  async remove(id: string): Promise<void> {
    this.logger.log(`Deleting brand: ${id}`);

    const existing = await this.prisma.brand.findUnique({
      where: { id },
      include: { products: { take: 1 } },
    });

    if (!existing) {
      throw new NotFoundException(`Brand with ID "${id}" not found`);
    }

    // Check if brand has products
    if (existing.products.length > 0) {
      throw new ConflictException(
        'Cannot delete brand with associated products',
      );
    }

    await this.prisma.brand.delete({ where: { id } });

    this.logger.log(`Brand deleted: ${id}`);
  }

  async verify(id: string): Promise<BrandEntity> {
    this.logger.log(`Verifying brand: ${id}`);

    const brand = await this.prisma.brand.update({
      where: { id },
      data: { isVerified: true },
    });

    return new BrandEntity(brand);
  }
}
