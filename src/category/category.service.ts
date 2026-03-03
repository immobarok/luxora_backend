import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CategoryEntity } from './entity/category.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateCategoryDto): Promise<CategoryEntity> {
    this.logger.log(`Creating category: ${dto.name}`);

    // Check slug uniqueness
    const existing = await this.prisma.category.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException(
        `Category with slug "${dto.slug}" already exists`,
      );
    }

    // Calculate level if parent exists
    let level = 0;
    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: dto.parentId },
      });
      if (!parent) {
        throw new NotFoundException(
          `Parent category not found: ${dto.parentId}`,
        );
      }
      level = parent.level + 1;
    }

    const category = await this.prisma.category.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        parentId: dto.parentId,
        level,
        sortOrder: dto.sortOrder || 0,
        isActive: true,
      },
      include: {
        parent: true,
        children: true,
      },
    });

    return new CategoryEntity(category);
  }

  async findAll(): Promise<CategoryEntity[]> {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ level: 'asc' }, { sortOrder: 'asc' }],
      include: {
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    // Return only root categories with nested children
    return categories
      .filter((c) => c.level === 0)
      .map((c) => new CategoryEntity(c));
  }

  async findById(id: string): Promise<CategoryEntity> {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: true,
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category not found: ${id}`);
    }

    return new CategoryEntity(category);
  }

  async findBySlug(slug: string): Promise<CategoryEntity> {
    const category = await this.prisma.category.findUnique({
      where: { slug },
      include: {
        parent: true,
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!category) {
      throw new NotFoundException(`Category not found: ${slug}`);
    }

    return new CategoryEntity(category);
  }

  async update(id: string, dto: UpdateCategoryDto): Promise<CategoryEntity> {
    this.logger.log(`Updating category: ${id}`);

    const existing = await this.prisma.category.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Category not found: ${id}`);
    }

    // Check slug uniqueness if changing
    if (dto.slug && dto.slug !== existing.slug) {
      const slugExists = await this.prisma.category.findUnique({
        where: { slug: dto.slug },
      });
      if (slugExists) {
        throw new ConflictException(`Slug "${dto.slug}" already in use`);
      }
    }

    // Recalculate level if parent changed
    let level = existing.level;
    if (dto.parentId !== undefined && dto.parentId !== existing.parentId) {
      if (dto.parentId === null) {
        level = 0;
      } else {
        const parent = await this.prisma.category.findUnique({
          where: { id: dto.parentId },
        });
        if (!parent) {
          throw new NotFoundException(
            `Parent category not found: ${dto.parentId}`,
          );
        }
        level = parent.level + 1;
      }
    }

    const updated = await this.prisma.category.update({
      where: { id },
      data: {
        ...dto,
        level,
      },
      include: {
        parent: true,
        children: true,
      },
    });

    return new CategoryEntity(updated);
  }

  async remove(id: string): Promise<void> {
    this.logger.log(`Deleting category: ${id}`);

    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { children: true },
    });

    if (!category) {
      throw new NotFoundException(`Category not found: ${id}`);
    }

    // Check if category has products
    const hasProducts = await this.prisma.productCategory.findFirst({
      where: { categoryId: id },
    });

    if (hasProducts) {
      throw new ConflictException(
        'Cannot delete category with associated products',
      );
    }

    // Soft delete or check children
    if (category.children.length > 0) {
      throw new ConflictException('Cannot delete category with sub-categories');
    }

    await this.prisma.category.delete({ where: { id } });
  }
}
