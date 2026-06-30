import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { AboutService } from './about.service';
import { UpdateAboutDto } from './dto/update-about.dto';
import { Public } from '../common/decorators';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, Role } from '../common/decorators/roles.decorator';

@Controller('about')
export class AboutController {
  constructor(private readonly aboutService: AboutService) {}

  @Public()
  @Get()
  async getAboutPage() {
    return this.aboutService.getAboutPage();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  @Put()
  async updateAboutPage(@Body() dto: UpdateAboutDto) {
    return this.aboutService.updateAboutPage(dto);
  }
}
