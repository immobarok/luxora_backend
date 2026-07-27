import { Controller, Get, Post, Body, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { AddToWishlistDto } from './dto/create-wishlist.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request } from 'express';

interface RequestWithUser extends Request {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

@Controller('wishlist')
@UseGuards(JwtAuthGuard)
export class WishlistController {
  constructor(private readonly wishlistService: WishlistService) {}

  @Get()
  async getWishlist(@Req() req: RequestWithUser) {
    const items = await this.wishlistService.getWishlist(req.user.id);
    return {
      success: true,
      message: 'Wishlist fetched successfully',
      data: items,
    };
  }

  @Post()
  async addToWishlist(
    @Req() req: RequestWithUser,
    @Body() dto: AddToWishlistDto,
  ) {
    const item = await this.wishlistService.addToWishlist(req.user.id, dto);
    return {
      success: true,
      message: 'Product added to wishlist',
      data: item,
    };
  }

  @Delete(':id')
  async removeFromWishlist(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
  ) {
    await this.wishlistService.removeFromWishlist(req.user.id, id);
    return {
      success: true,
      message: 'Product removed from wishlist',
    };
  }
}
