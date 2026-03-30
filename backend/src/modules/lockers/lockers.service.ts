import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';

@Injectable()
export class LockersService {
  constructor(private readonly prisma: PrismaService) {}

  async listLockers() {
    const lockers = await this.prisma.locker.findMany({
      include: { compartments: true },
      orderBy: { code: 'asc' },
    });

    return lockers.map((locker) => ({
      id: locker.id.toString(),
      code: locker.code,
      name: locker.name,
      location: locker.location,
      integrationType: locker.integrationType,
      active: locker.active,
      totals: {
        total: locker.compartments.length,
        free: locker.compartments.filter((c) => c.status === 'LIBRE').length,
        reserved: locker.compartments.filter((c) => c.status === 'RESERVADO').length,
        occupied: locker.compartments.filter((c) => c.status === 'OCUPADO').length,
        blocked: locker.compartments.filter((c) => c.status === 'BLOQUEADO').length,
        broken: locker.compartments.filter((c) => c.status === 'AVERIADO').length,
      },
    }));
  }

  async getLocker(lockerId: bigint) {
    const locker = await this.prisma.locker.findUnique({
      where: { id: lockerId },
      include: { compartments: { orderBy: { slotNumber: 'asc' } } },
    });

    if (!locker) {
      throw new NotFoundException('Locker no encontrado');
    }

    return {
      id: locker.id.toString(),
      code: locker.code,
      name: locker.name,
      location: locker.location,
      integrationType: locker.integrationType,
      active: locker.active,
      compartments: locker.compartments.map((c) => ({
        id: c.id.toString(),
        slotNumber: c.slotNumber,
        sizeCategory: c.sizeCategory,
        status: c.status,
        reservedForPackageId: c.reservedForPackageId?.toString() ?? null,
      })),
    };
  }

  async listCompartments(lockerId?: string, status?: string, sizeCategory?: string) {
    const compartments = await this.prisma.compartment.findMany({
      where: {
        lockerId: lockerId ? BigInt(lockerId) : undefined,
        status: status as any,
        sizeCategory: sizeCategory as any,
      },
      include: { locker: true },
      orderBy: [{ lockerId: 'asc' }, { slotNumber: 'asc' }],
    });

    return compartments.map((c) => ({
      id: c.id.toString(),
      lockerId: c.lockerId.toString(),
      lockerCode: c.locker.code,
      slotNumber: c.slotNumber,
      sizeCategory: c.sizeCategory,
      status: c.status,
      reservedForPackageId: c.reservedForPackageId?.toString() ?? null,
    }));
  }
}