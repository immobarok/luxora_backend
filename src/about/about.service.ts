import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateAboutDto } from './dto/update-about.dto';

@Injectable()
export class AboutService {
  constructor(private readonly prisma: PrismaService) {}

  async getAboutPage() {
    let about = await this.prisma.aboutPage.findFirst();

    if (!about) {
      // Create a default if it doesn't exist
      about = await this.prisma.aboutPage.create({
        data: {
          heroTitle: 'About Us',
          yearTitle: 'EST. 2026',
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

    // Since we're using raw JSON values from DTO, we need to cast them to Prisma.InputJsonValue or just ignore type errors if Prisma complains.
    // Usually prisma client accepts generic objects for JSON fields when updating if typed as any or appropriately mapped.
    const updateData: any = { ...dto };

    return this.prisma.aboutPage.update({
      where: { id: about.id },
      data: updateData,
    });
  }
}
