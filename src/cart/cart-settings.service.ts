import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CartSettings {
  TAX_RATE: number;
  FREE_SHIPPING_THRESHOLD: number;
  SHIPPING_COST: number;
}

@Injectable()
export class CartSettingsService {
  private readonly DEFAULT_SETTINGS: CartSettings = {
    TAX_RATE: 0.08,
    FREE_SHIPPING_THRESHOLD: 100,
    SHIPPING_COST: 10,
  };

  private cache: CartSettings | null = null;
  private cacheExpiry: Date | null = null;
  private readonly CACHE_TTL_MS = 5 * 60 * 1000;

  constructor(private readonly prisma: PrismaService) {
    void this.initializeSettings().catch(() => {
      // Avoid unhandled promise rejection during service bootstrap.
    });
  }

  private async initializeSettings(): Promise<void> {
    const existing = await this.prisma.cartSettings.findMany();

    if (existing.length === 0) {
      await this.prisma.cartSettings.createMany({
        data: [
          {
            key: 'TAX_RATE',
            value: '0.08',
            label: 'Tax Rate (%)',
            type: 'percentage',
          },
          {
            key: 'FREE_SHIPPING_THRESHOLD',
            value: '100',
            label: 'Free Shipping Threshold ($)',
            type: 'amount',
          },
          {
            key: 'SHIPPING_COST',
            value: '10',
            label: 'Shipping Cost ($)',
            type: 'amount',
          },
        ],
      });
    }
  }

  async getSettings(): Promise<CartSettings> {
    if (this.cache && this.cacheExpiry && new Date() < this.cacheExpiry) {
      return this.cache;
    }

    const settings = await this.prisma.cartSettings.findMany({
      where: { isActive: true },
    });

    const result: CartSettings = { ...this.DEFAULT_SETTINGS };

    for (const setting of settings) {
      const value = parseFloat(setting.value);
      if (setting.key === 'TAX_RATE') result.TAX_RATE = value;
      if (setting.key === 'FREE_SHIPPING_THRESHOLD')
        result.FREE_SHIPPING_THRESHOLD = value;
      if (setting.key === 'SHIPPING_COST') result.SHIPPING_COST = value;
    }

    this.cache = result;
    this.cacheExpiry = new Date(Date.now() + this.CACHE_TTL_MS);

    return result;
  }

  async updateSettings(
    settings: Partial<CartSettings>,
    adminId: string,
  ): Promise<CartSettings> {
    const updates: Promise<any>[] = [];

    if (settings.TAX_RATE !== undefined) {
      if (settings.TAX_RATE < 0 || settings.TAX_RATE > 1) {
        throw new BadRequestException('Tax rate must be between 0 and 1');
      }
      updates.push(
        this.prisma.cartSettings.update({
          where: { key: 'TAX_RATE' },
          data: { value: settings.TAX_RATE.toString(), updatedBy: adminId },
        }),
      );
    }

    if (settings.FREE_SHIPPING_THRESHOLD !== undefined) {
      updates.push(
        this.prisma.cartSettings.update({
          where: { key: 'FREE_SHIPPING_THRESHOLD' },
          data: {
            value: settings.FREE_SHIPPING_THRESHOLD.toString(),
            updatedBy: adminId,
          },
        }),
      );
    }

    if (settings.SHIPPING_COST !== undefined) {
      updates.push(
        this.prisma.cartSettings.update({
          where: { key: 'SHIPPING_COST' },
          data: {
            value: settings.SHIPPING_COST.toString(),
            updatedBy: adminId,
          },
        }),
      );
    }

    await Promise.all(updates);
    this.clearCache();

    return this.getSettings();
  }

  async getSettingsWithMetadata() {
    const settings = await this.prisma.cartSettings.findMany({
      include: {
        updatedByUser: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { key: 'asc' },
    });

    return settings.map((s) => ({
      key: s.key,
      value: parseFloat(s.value),
      label: s.label,
      type: s.type,
      isActive: s.isActive,
      updatedAt: s.updatedAt,
      updatedBy: s.updatedByUser
        ? {
            id: s.updatedByUser.id,
            name: `${s.updatedByUser.firstName} ${s.updatedByUser.lastName}`,
            email: s.updatedByUser.email,
          }
        : null,
    }));
  }

  clearCache(): void {
    this.cache = null;
    this.cacheExpiry = null;
  }
}
