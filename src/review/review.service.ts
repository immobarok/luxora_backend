import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewService {
  constructor(private readonly prisma: PrismaService) {}

  private async updateProductRating(productId: string) {
    const reviews = await this.prisma.review.findMany({
      where: { productId, status: 'APPROVED' },
      select: { rating: true },
    });

    const reviewCount = reviews.length;
    const avgRating = reviewCount > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
      : 0;

    await this.prisma.product.update({
      where: { id: productId },
      data: { reviewCount, avgRating },
    });
  }

  async create(userId: string, dto: CreateReviewDto) {
    // Check if product exists
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Optional: Auto-approve for now. If you want manual approval, change status to 'PENDING'.
    // Also, if orderId is provided, you can verify they actually bought it.
    
    // Check if user already reviewed this product
    const existingReview = await this.prisma.review.findFirst({
      where: { userId, productId: dto.productId },
    });

    if (existingReview) {
      throw new BadRequestException('You have already reviewed this product');
    }

    const review = await this.prisma.review.create({
      data: {
        userId,
        productId: dto.productId,
        orderId: dto.orderId,
        rating: dto.rating,
        title: dto.title,
        body: dto.body,
        images: dto.images || [],
        status: 'APPROVED', // Assuming auto-approve for simplicity
      },
    });

    // Recalculate average rating
    await this.updateProductRating(dto.productId);

    return review;
  }

  async findByProduct(productId: string) {
    return this.prisma.review.findMany({
      where: { productId, status: 'APPROVED' },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
          }
        }
      }
    });
  }

  async remove(userId: string, id: string) {
    const review = await this.prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    // Only allow the author (or an admin) to delete it
    if (review.userId !== userId) {
      // If we had a strict admin check here we could allow admins to bypass this.
      // For now, only the author can delete it (unless we pass in user role).
      throw new BadRequestException('You can only delete your own reviews');
    }

    await this.prisma.review.delete({
      where: { id },
    });

    // Recalculate average rating
    await this.updateProductRating(review.productId);

    return { success: true };
  }
}
