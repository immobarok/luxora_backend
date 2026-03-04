// src/cart/cart.controller.ts

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  Headers,
  BadRequestException,
} from '@nestjs/common';
import { CartService } from './cart.service';
import { AddToCartDto, UpdateCartItemDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator';
import { Request } from 'express';
import * as uuid from 'uuid';

interface RequestWithUser extends Request {
  user: { id: string };
}

@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  async getCart(@Req() req: RequestWithUser) {
    return this.cartService.getCart(req.user.id);
  }

  @Get('guest')
  @Public()
  async getGuestCart(@Headers('x-session-id') sessionId: string) {
    if (!sessionId) sessionId = uuid.v4();
    return this.cartService.getGuestCart(sessionId);
  }

  @Post('items')
  @UseGuards(JwtAuthGuard)
  async addToCart(@Req() req: RequestWithUser, @Body() dto: AddToCartDto) {
    return this.cartService.addToCart(req.user.id, dto);
  }

  @Post('guest/items')
  @Public()
  async addToGuestCart(
    @Headers('x-session-id') sessionId: string,
    @Body() dto: AddToCartDto,
  ) {
    if (!sessionId) throw new BadRequestException('Session ID required');
    return this.cartService.addToGuestCart(sessionId, dto);
  }

  @Patch('items/:itemId')
  @UseGuards(JwtAuthGuard)
  async updateCartItem(
    @Req() req: RequestWithUser,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateCartItem(req.user.id, itemId, dto);
  }

  @Delete('items/:itemId')
  @UseGuards(JwtAuthGuard)
  async removeCartItem(
    @Req() req: RequestWithUser,
    @Param('itemId') itemId: string,
  ) {
    return this.cartService.removeCartItem(req.user.id, itemId);
  }

  @Delete()
  @UseGuards(JwtAuthGuard)
  async clearCart(@Req() req: RequestWithUser) {
    return this.cartService.clearCart(req.user.id);
  }

  @Post('merge')
  @UseGuards(JwtAuthGuard)
  async mergeCart(
    @Req() req: RequestWithUser,
    @Headers('x-session-id') sessionId: string,
  ) {
    if (!sessionId) throw new BadRequestException('Session ID required');
    return this.cartService.mergeGuestCartToUser(sessionId, req.user.id);
  }
}
