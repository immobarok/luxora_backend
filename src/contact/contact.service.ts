import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { MailService } from '../mail/mail.service';

@Injectable()
export class ContactService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async create(dto: CreateContactDto) {
    const message = await this.prisma.contactMessage.create({
      data: {
        fullName: dto.fullName,
        email: dto.email,
        subject: dto.subject,
        message: dto.message,
        category: dto.category,
        status: 'PENDING',
      },
    });

    try {
      await this.mailService.sendContactConfirmation(
        dto.email,
        dto.fullName,
        dto.subject,
      );
    } catch (e) {
      console.warn('Failed to send contact confirmation email:', e);
    }

    return message;
  }

  async findAll() {
    return this.prisma.contactMessage.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async resolve(id: number) {
    const msg = await this.prisma.contactMessage.findUnique({
      where: { id },
    });

    if (!msg) {
      throw new NotFoundException('Message not found');
    }

    return this.prisma.contactMessage.update({
      where: { id },
      data: { status: 'RESOLVED' },
    });
  }
}
