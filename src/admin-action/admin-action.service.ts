import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminActionService {
  constructor(private readonly prisma: PrismaService) {}

  async getAuditLogs(limit: number = 100) {
    return this.prisma.adminAction.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        admin: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
    });
  }

  async logAction(
    adminId: string,
    action: string,
    targetType: string,
    targetId: string,
    reason: string,
    metadata?: any,
  ) {
    return this.prisma.adminAction.create({
      data: {
        adminId,
        action,
        targetType,
        targetId,
        reason,
        metadata: metadata ? metadata : undefined,
      },
    });
  }
}
