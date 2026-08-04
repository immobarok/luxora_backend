import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateAboutDto } from './dto/update-about.dto';

@Injectable()
export class AboutService {
  constructor(private readonly prisma: PrismaService) {}

  async getAboutPage() {
    let about = await this.prisma.aboutPage.findFirst();

    if (!about) {
      about = await this.prisma.aboutPage.create({
        data: {
          heroTitle: 'About Us',
          yearTitle: 'ESTABLISHED 2026',
          missionTitle: 'Our Mission',
          missionDescription: 'Mission description',
          missionQuote: 'Our mission quote',
          studioTitle: 'Our Studio',
          studioDescription: 'Studio description',
          ctaTitle: 'Join Us',
          ctaButtonText: 'Contact Us',
          ctaButtonLink: '/contact',
        },
      });
    }

    return about;
  }

  async updateAboutPage(dto: UpdateAboutDto) {
    const about = await this.getAboutPage();

    const updateData: any = { ...dto };

    return this.prisma.aboutPage.update({
      where: { id: about.id },
      data: updateData,
    });
  }
}
