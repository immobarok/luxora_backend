import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CheckoutService } from './checkout.service';
import {
  CreateOrderDto,
  CheckoutDto,
  UpdateOrderStatusDto,
  OrderQueryDto,
  CancelOrderDto,
} from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, Role } from '../common/decorators/roles.decorator';

interface RequestWithUser extends Request {
  user: { id: string };
}

@Controller('orders')
export class OrderController {
  constructor(
    private readonly orderService: OrderService,
    private readonly checkoutService: CheckoutService,
  ) {}

  // Create order from cart (step 1)
  @Post()
  @UseGuards(JwtAuthGuard)
  async createOrder(@Req() req: RequestWithUser, @Body() dto: CreateOrderDto) {
    return this.orderService.createOrderFromCart(req.user.id, dto);
  }

  // Checkout (create order + payment) (step 2)
  @Post('checkout')
  @UseGuards(JwtAuthGuard)
  async checkout(@Req() req: RequestWithUser, @Body() dto: CheckoutDto) {
    return this.checkoutService.processCheckout(req.user.id, dto);
  }

  // Validate checkout
  @Get('checkout/validate')
  @UseGuards(JwtAuthGuard)
  async validateCheckout(@Req() req: RequestWithUser) {
    return this.checkoutService.validateCheckout(req.user.id);
  }

  // Get my orders
  @Get('my-orders')
  @UseGuards(JwtAuthGuard)
  async getMyOrders(
    @Req() req: RequestWithUser,
    @Query() query: OrderQueryDto,
  ) {
    return this.orderService.getUserOrders(req.user.id, query);
  }

  // Get order by ID
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getOrder(@Req() req: RequestWithUser, @Param('id') orderId: string) {
    return this.orderService.getOrderById(orderId, req.user.id);
  }

  // Cancel order
  @Post(':id/cancel')
  @UseGuards(JwtAuthGuard)
  async cancelOrder(
    @Req() req: RequestWithUser,
    @Param('id') orderId: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.orderService.cancelOrder(orderId, req.user.id, dto.reason);
  }

  // Admin: Get all orders
  @Get('admin/all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async getAllOrders(@Query() query: OrderQueryDto) {
    return this.orderService.getAllOrders(query);
  }

  // Admin: Get single order by ID
  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async getAdminOrder(@Param('id') orderId: string) {
    return this.orderService.getOrderByIdForAdmin(orderId);
  }

  // Admin: Get order statistics
  @Get('admin/stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async getOrderStats() {
    return this.orderService.getOrderStats();
  }

  // Admin: Update order status
  @Patch(':id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  async updateStatus(
    @Req() req: RequestWithUser,
    @Param('id') orderId: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.orderService.updateOrderStatus(
      orderId,
      dto.status,
      req.user.id,
      dto.comment,
    );
  }
}
