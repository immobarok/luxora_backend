import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AddToWishlistDto } from './dto/create-wishlist.dto';

@Injectable()
export class WishlistService {
  constructor(private readonly prisma: PrismaService) {}

  // Helper to get or create a user's wishlist
  private async getOrCreateWishlist(userId: string) {
    let wishlist = await this.prisma.wishlist.findUnique({
      where: { userId },
    });

    if (!wishlist) {
      wishlist = await this.prisma.wishlist.create({
        data: { userId },
      });
    }

    return wishlist;
  }

  async getWishlist(userId: string) {
    const wishlist = await this.getOrCreateWishlist(userId);

    const items = await this.prisma.wishlistItem.findMany({
      where: { wishlistId: wishlist.id },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            basePrice: true,
            compareAtPrice: true,
            media: true,
          }
        }
      },
      orderBy: { addedAt: 'desc' }
    });

    return items;
  }

  async addToWishlist(userId: string, dto: AddToWishlistDto) {
    // Check if product exists
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const wishlist = await this.getOrCreateWishlist(userId);

    // Check if already in wishlist
    const existing = await this.prisma.wishlistItem.findUnique({
      where: {
        wishlistId_productId: {
          wishlistId: wishlist.id,
          productId: dto.productId,
        }
      }
    });

    if (existing) {
      throw new BadRequestException('Product is already in your wishlist');
    }

    const item = await this.prisma.wishlistItem.create({
      data: {
        wishlistId: wishlist.id,
        productId: dto.productId,
      },
      include: {
        product: true,
      }
    });

    return item;
  }

  async removeFromWishlist(userId: string, itemId: string) {
    const wishlist = await this.getOrCreateWishlist(userId);

    const item = await this.prisma.wishlistItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new NotFoundException('Wishlist item not found');
    }

    if (item.wishlistId !== wishlist.id) {
      throw new BadRequestException('You do not own this wishlist item');
    }

    await this.prisma.wishlistItem.delete({
      where: { id: itemId },
    });

    return { success: true };
  }
}
