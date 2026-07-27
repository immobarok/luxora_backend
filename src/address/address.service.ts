import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

const ADDRESS_SELECT = {
  id: true,
  type: true,
  isDefault: true,
  firstName: true,
  lastName: true,
  phone: true,
  line1: true,
  line2: true,
  city: true,
  state: true,
  postalCode: true,
  country: true,
  isVerified: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class AddressService {
  private readonly MAX_ADDRESSES_PER_USER = 10;

  constructor(private readonly prisma: PrismaService) {}

  // ── List ──────────────────────────────────────────────────────────────────

  async getUserAddresses(userId: string) {
    return this.prisma.address.findMany({
      where: { userId },
      select: ADDRESS_SELECT,
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    });
  }

  // ── Get one ───────────────────────────────────────────────────────────────

  async getAddressById(id: string, userId: string) {
    const address = await this.prisma.address.findFirst({
      where: { id, userId },
      select: ADDRESS_SELECT,
    });
    if (!address) {
      throw new NotFoundException('Address not found');
    }
    return address;
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async createAddress(userId: string, dto: CreateAddressDto) {
    // Enforce max addresses per user
    const count = await this.prisma.address.count({ where: { userId } });
    if (count >= this.MAX_ADDRESSES_PER_USER) {
      throw new BadRequestException(
        `You can have at most ${this.MAX_ADDRESSES_PER_USER} saved addresses. Please remove one first.`,
      );
    }

    // If this is the user's first address or explicitly set as default,
    // clear the existing default of the same type first
    const isDefault = dto.isDefault ?? count === 0;

    if (isDefault) {
      await this.clearDefaultForType(userId, dto.type);
    }

    return this.prisma.address.create({
      data: {
        userId,
        type: dto.type,
        isDefault,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        line1: dto.line1,
        line2: dto.line2 ?? null,
        city: dto.city,
        state: dto.state,
        postalCode: dto.postalCode,
        country: dto.country,
      },
      select: ADDRESS_SELECT,
    });
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async updateAddress(id: string, userId: string, dto: UpdateAddressDto) {
    // Verify ownership
    await this.getAddressById(id, userId);

    // If setting as default, clear existing default of same type
    if (dto.isDefault) {
      const current = await this.prisma.address.findUnique({
        where: { id },
        select: { type: true },
      });
      if (current) {
        await this.clearDefaultForType(userId, dto.type ?? current.type);
      }
    }

    return this.prisma.address.update({
      where: { id },
      data: {
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
        ...(dto.firstName !== undefined && { firstName: dto.firstName }),
        ...(dto.lastName !== undefined && { lastName: dto.lastName }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.line1 !== undefined && { line1: dto.line1 }),
        ...(dto.line2 !== undefined && { line2: dto.line2 }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.state !== undefined && { state: dto.state }),
        ...(dto.postalCode !== undefined && { postalCode: dto.postalCode }),
        ...(dto.country !== undefined && { country: dto.country }),
      },
      select: ADDRESS_SELECT,
    });
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async deleteAddress(id: string, userId: string) {
    // Verify ownership before deleting
    const address = await this.prisma.address.findFirst({
      where: { id, userId },
      select: { id: true, isDefault: true, type: true },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    // Prevent deleting addresses that are linked to active orders
    const linkedOrderCount = await this.prisma.order.count({
      where: {
        OR: [{ shippingAddressId: id }, { billingAddressId: id }],
        status: {
          notIn: ['DELIVERED', 'CANCELLED', 'REFUNDED'],
        },
      },
    });

    if (linkedOrderCount > 0) {
      throw new ForbiddenException(
        'Cannot delete an address linked to an active order. Wait until the order is delivered or cancelled.',
      );
    }

    await this.prisma.address.delete({ where: { id } });

    // If deleted address was the default, promote the next newest address of same type
    if (address.isDefault) {
      const next = await this.prisma.address.findFirst({
        where: { userId, type: address.type },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (next) {
        await this.prisma.address.update({
          where: { id: next.id },
          data: { isDefault: true },
        });
      }
    }

    return { deleted: true, id };
  }

  // ── Set Default ───────────────────────────────────────────────────────────

  async setDefaultAddress(id: string, userId: string) {
    const address = await this.prisma.address.findFirst({
      where: { id, userId },
      select: { id: true, type: true },
    });

    if (!address) {
      throw new NotFoundException('Address not found');
    }

    // Clear current default for this type
    await this.clearDefaultForType(userId, address.type);

    // Set new default
    return this.prisma.address.update({
      where: { id },
      data: { isDefault: true },
      select: ADDRESS_SELECT,
    });
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Unsets the `isDefault` flag for all addresses of the given type for a user.
   * Called before setting a new default.
   */
  private async clearDefaultForType(
    userId: string,
    type: string,
  ): Promise<void> {
    // If type is BOTH, clear ALL defaults
    const typeFilter =
      type === 'BOTH'
        ? { in: ['SHIPPING', 'BILLING', 'BOTH'] }
        : { in: [type, 'BOTH'] };

    await this.prisma.address.updateMany({
      where: { userId, type: typeFilter, isDefault: true },
      data: { isDefault: false },
    });
  }
}
