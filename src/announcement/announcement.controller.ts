import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Public } from '../common/decorators/public.decorator';
import { Role, Roles } from '../common/decorators/roles.decorator';
import { AnnouncementService } from './announcement.service';
import { CreateAnnouncementDto } from './dto/create-announcement.dto';
import { UpdateAnnouncementDto } from './dto/update-announcement.dto';

@Controller('announcements')
export class AnnouncementController {
  constructor(private readonly announcementService: AnnouncementService) {}
  @Get('active')
  @Public()
  findActive() {
    return this.announcementService.findActive();
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async create(@Body() createAnnouncementDto: CreateAnnouncementDto) {
    return {
      success: true,
      message: 'Announcement created successfully',
      data: await this.announcementService.create(createAnnouncementDto),
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async findAll() {
    const announcements = await this.announcementService.findAll();
    return {
      success: true,
      message: 'Announcements fetched successfully',
      data: announcements,
    };
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async findOne(@Param('id') id: string) {
    const announcement = await this.announcementService.findOne(id);
    return {
      success: true,
      message: 'Announcement fetched successfully',
      data: announcement,
    };
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateAnnouncementDto: UpdateAnnouncementDto,
  ) {
    return {
      success: true,
      message: 'Announcement updated successfully',
      data: await this.announcementService.update(id, updateAnnouncementDto),
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async remove(@Param('id') id: string) {
    return {
      success: true,
      message: 'Announcement deleted successfully',
      data: await this.announcementService.remove(id),
    };
  }
}
