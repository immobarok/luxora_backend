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

    // Send a confirmation email using the MailService
    // Since the MailService might not have a specific contact template yet,
    // we just use sendMail (if it exists) or a generic one.
    // I'll wrap in try-catch so it doesn't fail the request if mail is unconfigured.
    // try {
    //   await this.mailService.sendEmail({
    //     to: dto.email,
    //     subject: 'We received your message!',
    //     // @ts-ignore - Need to add a generic template to MailService
    //     html: `<p>Hi ${dto.fullName},</p><p>We have received your message regarding "${dto.subject}". Our support team will get back to you shortly.</p>`,
    //   });
    // } catch (e) {
    //   console.warn('Failed to send contact confirmation email:', e);
    // }

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
