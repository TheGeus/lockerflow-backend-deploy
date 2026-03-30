import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  getLiveness() {
    return {
      status: 'ok',
      service: 'lockerflow-backend',
      checks: {
        api: 'up',
      },
    };
  }

  async getReadiness() {
    await this.prisma.$queryRaw`SELECT 1`;

    return {
      status: 'ok',
      service: 'lockerflow-backend',
      checks: {
        api: 'up',
        database: 'up',
      },
    };
  }
}
