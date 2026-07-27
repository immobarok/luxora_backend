import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

@Injectable()
export class AnnouncementService {
  constructor(private readonly prisma: PrismaService) {}
  create(createAnnouncementDto: CreateAnnouncementDto) {
    return this.prisma.announcement.create({
      data: createAnnouncementDto,
    });
  }

  async findActive() {
    return this.prisma.announcement.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  findAll() {
    return this.prisma.announcement.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const announcement = await this.prisma.announcement.findUnique({
      where: {
        id,
      },
    });

    if (!announcement) {
      throw new NotFoundException(`Announcement with id ${id} not found`);
    }
    return announcement;
  }

  async update(id: string, updateAnnouncementDto: UpdateAnnouncementDto) {
    const announcement = await this.prisma.announcement.findUnique({
      where: {
        id,
      },
    });

    if (!announcement) {
      throw new NotFoundException(`Announcement with id ${id} not found`);
    }
    return this.prisma.announcement.update({
      where: {
        id,
      },
      data: updateAnnouncementDto,
    });
  }

  async remove(id: string) {
    const announcement = await this.prisma.announcement.findUnique({
      where: {
        id,
      },
    });

    if (!announcement) {
      throw new NotFoundException(`Announcement with id ${id} not found`);
    }
    return this.prisma.announcement.delete({
      where: {
        id,
      },
    });
  }
}
