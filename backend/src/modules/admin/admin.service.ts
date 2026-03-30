import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard() {
    const [lockersTotal, compartmentsTotal, packagesTotal, overflowPending, incidentsOpen] = await Promise.all([
      this.prisma.locker.count(),
      this.prisma.compartment.count(),
      this.prisma.package.count(),
      this.prisma.overflowItem.count({ where: { status: 'WAITING' } }),
      this.prisma.incident.count({ where: { status: 'OPEN' } }),
    ]);

    return {
      lockersTotal,
      compartmentsTotal,
      packagesTotal,
      overflowPending,
      incidentsOpen,
    };
  }
}
