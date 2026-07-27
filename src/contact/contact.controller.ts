import { Controller, Get, Post, Body, Patch, Param, UseGuards } from '@nestjs/common';
import { ContactService } from './contact.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { Public } from '../common/decorators/public.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, Role } from '../common/decorators/roles.decorator';

@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post()
  @Public()
  async create(@Body() createContactDto: CreateContactDto) {
    const msg = await this.contactService.create(createContactDto);
    return {
      success: true,
      message: 'Your message has been sent successfully.',
      data: msg,
    };
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async findAll() {
    const messages = await this.contactService.findAll();
    return {
      success: true,
      message: 'Contact messages fetched successfully.',
      data: messages,
    };
  }

  @Patch('admin/:id/resolve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async resolve(@Param('id') id: string) {
    const updated = await this.contactService.resolve(+id);
    return {
      success: true,
      message: 'Message marked as resolved.',
      data: updated,
    };
  }
}
