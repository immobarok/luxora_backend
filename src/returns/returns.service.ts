import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReturnDto } from './dto/create-return.dto';
import { UpdateReturnStatusDto } from './dto/update-return.dto';

@Injectable()
export class ReturnsService {
  constructor(private readonly prisma: PrismaService) {}

  private generateReturnNumber() {
    return `RET-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  async createReturnRequest(userId: string, dto: CreateReturnDto) {
    // 1. Verify the order belongs to this user
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.userId !== userId) {
      throw new BadRequestException('You do not own this order');
    }

    // 2. Check if a return already exists for this order
    const existingReturn = await this.prisma.return.findFirst({
      where: { orderId: dto.orderId },
    });

    if (existingReturn) {
      throw new BadRequestException('A return request already exists for this order');
    }

    // 3. Create the return request
    const returnRequest = await this.prisma.return.create({
      data: {
        orderId: dto.orderId,
        returnNumber: this.generateReturnNumber(),
        items: dto.items as any, // Prisma Json type
        primaryReason: dto.primaryReason,
        customerComment: dto.customerComment,
        status: 'REQUESTED',
      },
    });

    return returnRequest;
  }

  async getMyReturns(userId: string) {
    return this.prisma.return.findMany({
      where: { order: { userId } },
      include: {
        order: {
          select: { orderNumber: true, status: true, grandTotal: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllReturns() {
    return this.prisma.return.findMany({
      include: {
        order: {
          select: { orderNumber: true, userId: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateReturnStatus(id: string, dto: UpdateReturnStatusDto) {
    const returnReq = await this.prisma.return.findUnique({
      where: { id },
    });

    if (!returnReq) {
      throw new NotFoundException('Return request not found');
    }

    const dataToUpdate: any = {
      status: dto.status ?? returnReq.status,
      adminNotes: dto.adminNotes ?? returnReq.adminNotes,
    };

    if (dto.refundAmount !== undefined) {
      dataToUpdate.refundAmount = dto.refundAmount;
    }

    if (dto.status === 'REFUNDED') {
      dataToUpdate.resolvedAt = new Date();
    }

    const updated = await this.prisma.return.update({
      where: { id },
      data: dataToUpdate,
    });

    return updated;
  }
}
