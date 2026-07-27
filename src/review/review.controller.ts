import { Controller, Get, Post, Body, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/create-review.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';

interface RequestWithUser extends Request {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(
    @Req() req: RequestWithUser,
    @Body() dto: CreateReviewDto,
  ) {
    const review = await this.reviewService.create(req.user.id, dto);
    return {
      success: true,
      message: 'Review submitted successfully',
      data: review,
    };
  }

  @Get('product/:productId')
  @Public()
  async findByProduct(@Param('productId') productId: string) {
    const reviews = await this.reviewService.findByProduct(productId);
    return {
      success: true,
      message: 'Reviews fetched successfully',
      data: reviews,
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async remove(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    await this.reviewService.remove(req.user.id, id);
    return {
      success: true,
      message: 'Review deleted successfully',
    };
  }
}
