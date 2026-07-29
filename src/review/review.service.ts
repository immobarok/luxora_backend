import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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
    const avgRating =
      reviewCount > 0
        ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviewCount
        : 0;

    await this.prisma.product.update({
      where: { id: productId },
      data: { reviewCount, avgRating },
    });
  }

  async checkEligibility(userId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        OR: [{ id: productId }, { slug: productId }],
      },
      select: { id: true, name: true },
    });

    if (!product) {
      return { canReview: false, reason: 'Product not found' };
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    const existingReview = await this.prisma.review.findFirst({
      where: { userId, productId: product.id },
    });

    if (existingReview) {
      return {
        canReview: false,
        hasReviewed: true,
        reason: 'You have already submitted a review for this product',
      };
    }

    const deliveredOrder = await this.prisma.order.findFirst({
      where: {
        OR: [
          { userId },
          ...(user?.email ? [{ guestEmail: user.email }] : []),
        ],
        status: 'DELIVERED',
        items: {
          some: {
            variant: {
              productId: product.id,
            },
          },
        },
      },
      select: { id: true },
    });

    if (!deliveredOrder) {
      return {
        canReview: false,
        hasReviewed: false,
        reason:
          'Only customers who have ordered and received delivery of this product can leave a review',
      };
    }

    return {
      canReview: true,
      hasReviewed: false,
      productId: product.id,
      orderId: deliveredOrder.id,
    };
  }

  async create(userId: string, dto: CreateReviewDto) {
    const eligibility = await this.checkEligibility(userId, dto.productId);
    if (!eligibility.canReview) {
      throw new BadRequestException(
        eligibility.reason || 'You are not eligible to review this product',
      );
    }

    const targetProductId = eligibility.productId || dto.productId;

    const review = await this.prisma.review.create({
      data: {
        userId,
        productId: targetProductId,
        orderId: eligibility.orderId || dto.orderId,
        rating: dto.rating,
        title: dto.title,
        body: dto.body,
        images: dto.images || [],
        status: 'APPROVED',
      },
    });

    await this.updateProductRating(targetProductId);

    return review;
  }

  async findByProduct(productId: string) {
    const product = await this.prisma.product.findFirst({
      where: {
        OR: [{ id: productId }, { slug: productId }],
      },
      select: { id: true },
    });

    const targetProductId = product?.id || productId;

    return this.prisma.review.findMany({
      where: { productId: targetProductId, status: 'APPROVED' },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            avatarUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async remove(userId: string, id: string) {
    const review = await this.prisma.review.findUnique({
      where: { id },
    });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.userId !== userId) {
      throw new BadRequestException('You can only delete your own reviews');
    }

    await this.prisma.review.delete({
      where: { id },
    });

    await this.updateProductRating(review.productId);
  }
}
