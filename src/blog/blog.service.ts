import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBlogDto } from './dto/create-blog.dto';
import { UpdateBlogDto } from './dto/update-blog.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class BlogService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createBlogDto: CreateBlogDto) {
    return this.prisma.blog.create({
      data: createBlogDto,
    });
  }

  async findAll(query?: { category?: string; featured?: boolean; isPublished?: boolean }) {
    const where: Prisma.BlogWhereInput = {};

    if (query?.category && query.category !== 'All') {
      where.category = query.category;
    }

    if (query?.featured !== undefined) {
      where.featured = query.featured;
    }

    if (query?.isPublished !== undefined) {
      where.isPublished = query.isPublished;
    }

    return this.prisma.blog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        images: true,
      },
    });
  }

  async findOne(id: number) {
    const blog = await this.prisma.blog.findUnique({
      where: { id },
      include: {
        images: true,
      },
    });

    if (!blog) {
      throw new NotFoundException(`Blog post with ID ${id} not found`);
    }

    return blog;
  }

  async update(id: number, updateBlogDto: UpdateBlogDto) {
    // Check if exists
    await this.findOne(id);

    return this.prisma.blog.update({
      where: { id },
      data: updateBlogDto,
    });
  }

  async remove(id: number) {
    // Check if exists
    await this.findOne(id);

    return this.prisma.blog.delete({
      where: { id },
    });
  }
}
