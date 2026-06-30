import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CustomerQueryDto } from './dto/customer-query.dto';
import { Prisma, Role, AccountStatus } from '@prisma/client';

@Injectable()
export class CustomerService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: CustomerQueryDto) {
    const { page = 1, limit = 10, search, status } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      role: Role.CUSTOMER,
    };

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status as AccountStatus;
    }

    const [total, customers] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          phone: true,
          status: true,
          isEmailVerified: true,
          createdAt: true,
          lastLoginAt: true,
        },
      }),
    ]);

    return {
      data: customers,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getStats() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [totalCustomers, newThisMonth, activeCustomers, verifiedCustomers] = await Promise.all([
      this.prisma.user.count({ where: { role: Role.CUSTOMER } }),
      this.prisma.user.count({
        where: { role: Role.CUSTOMER, createdAt: { gte: startOfMonth } },
      }),
      this.prisma.user.count({
        where: { role: Role.CUSTOMER, status: AccountStatus.ACTIVE },
      }),
      this.prisma.user.count({
        where: { role: Role.CUSTOMER, isEmailVerified: true },
      }),
    ]);

    return {
      totalCustomers,
      newThisMonth,
      activeCustomers,
      verifiedCustomers,
    };
  }

  async exportCustomers(): Promise<string> {
    const customers = await this.prisma.user.findMany({
      where: { role: Role.CUSTOMER },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        status: true,
        createdAt: true,
      },
    });

    const headers = ['ID', 'Email', 'First Name', 'Last Name', 'Phone', 'Status', 'Registered At'];
    const rows = customers.map(c => [
      c.id,
      c.email,
      c.firstName,
      c.lastName,
      c.phone || '',
      c.status,
      c.createdAt.toISOString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(v => `"${v}"`).join(',')),
    ].join('\n');

    return csvContent;
  }

  async findOne(id: string) {
    const customer = await this.prisma.user.findUnique({
      where: { id, role: Role.CUSTOMER },
      include: {
        profile: true,
        addresses: true,
        _count: {
          select: { orders: true, reviews: true },
        },
      },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    const { passwordHash, twoFactorSecret, ...result } = customer;
    return result;
  }

  async remove(id: string) {
    const customer = await this.prisma.user.findUnique({
      where: { id, role: Role.CUSTOMER },
    });

    if (!customer) {
      throw new NotFoundException(`Customer with ID ${id} not found`);
    }

    return this.prisma.user.delete({
      where: { id },
    });
  }
}
