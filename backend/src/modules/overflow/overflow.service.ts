import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CompartmentStatus, OverflowStatus, PackageStatus, SizeCategory } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class OverflowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(status?: string) {
    const rows = await this.prisma.overflowItem.findMany({
      where: { status: status as any },
      include: {
        package: {
          include: { person: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => ({
      id: row.id.toString(),
      reason: row.reason,
      status: row.status,
      package: {
        id: row.package.id.toString(),
        trackingNumber: row.package.trackingNumber,
        personName: row.package.person.fullName,
      },
      createdAt: row.createdAt.toISOString(),
    }));
  }

  async retryAssignment(overflowId: bigint, employeeId: bigint) {
    return this.prisma.$transaction(async (tx) => {
      const overflowItem = await tx.overflowItem.findUnique({
        where: { id: overflowId },
        include: {
          package: true,
        },
      });

      if (!overflowItem) {
        throw new NotFoundException('Overflow no encontrado');
      }

      if (overflowItem.status !== OverflowStatus.WAITING) {
        throw new ConflictException('El overflow ya no esta pendiente');
      }

      if (overflowItem.package.status !== PackageStatus.OVERFLOW) {
        throw new ConflictException('El paquete no esta en estado overflow');
      }

      const candidates = await tx.compartment.findMany({
        where: {
          status: CompartmentStatus.LIBRE,
          sizeCategory: { in: this.compatibleSizes(overflowItem.package.sizeCategory) },
        },
        include: { locker: true },
        orderBy: [{ lockerId: 'asc' }, { slotNumber: 'asc' }],
      });

      const sortedCandidates = candidates.sort(
        (a, b) =>
          this.sizePriority(a.sizeCategory, overflowItem.package.sizeCategory) -
          this.sizePriority(b.sizeCategory, overflowItem.package.sizeCategory),
      );

      for (const candidate of sortedCandidates) {
        const reserved = await tx.compartment.updateMany({
          where: {
            id: candidate.id,
            status: CompartmentStatus.LIBRE,
          },
          data: {
            status: CompartmentStatus.RESERVADO,
            reservedForPackageId: overflowItem.package.id,
            lastStatusChangeAt: new Date(),
          },
        });

        if (reserved.count === 1) {
          await tx.package.update({
            where: { id: overflowItem.package.id },
            data: {
              status: PackageStatus.ASSIGNED,
              assignedCompartmentId: candidate.id,
              overflowReason: null,
            },
          });

          await tx.overflowItem.update({
            where: { id: overflowItem.id },
            data: {
              status: OverflowStatus.REASSIGNED,
              notes: 'Reasignado desde panel admin',
            },
          });

          await this.auditService.log(
            'OVERFLOW',
            overflowItem.id,
            'OVERFLOW_REASSIGNED',
            {
              packageId: overflowItem.package.id.toString(),
              compartmentId: candidate.id.toString(),
              lockerId: candidate.lockerId.toString(),
            },
            employeeId,
            tx,
          );

          return {
            overflowId: overflowItem.id.toString(),
            status: OverflowStatus.REASSIGNED,
            packageId: overflowItem.package.id.toString(),
            compartment: {
              id: candidate.id.toString(),
              slotNumber: candidate.slotNumber,
              lockerCode: candidate.locker.code,
            },
          };
        }
      }

      throw new ConflictException('No hay huecos libres compatibles para reasignar');
    });
  }

  async reject(overflowId: bigint, employeeId: bigint, notes?: string) {
    return this.prisma.$transaction(async (tx) => {
      const overflowItem = await tx.overflowItem.findUnique({
        where: { id: overflowId },
        include: { package: true },
      });

      if (!overflowItem) {
        throw new NotFoundException('Overflow no encontrado');
      }

      if (overflowItem.status !== OverflowStatus.WAITING) {
        throw new ConflictException('El overflow ya no esta pendiente');
      }

      await tx.overflowItem.update({
        where: { id: overflowItem.id },
        data: {
          status: OverflowStatus.REJECTED,
          notes,
        },
      });

      await tx.package.update({
        where: { id: overflowItem.package.id },
        data: {
          status: PackageStatus.CANCELLED,
          overflowReason: 'REJECTED_BY_ADMIN',
        },
      });

      await this.auditService.log(
        'OVERFLOW',
        overflowItem.id,
        'OVERFLOW_REJECTED',
        {
          packageId: overflowItem.package.id.toString(),
          notes: notes ?? null,
        },
        employeeId,
        tx,
      );

      return {
        overflowId: overflowItem.id.toString(),
        status: OverflowStatus.REJECTED,
        packageId: overflowItem.package.id.toString(),
      };
    });
  }

  private compatibleSizes(requested: SizeCategory): SizeCategory[] {
    switch (requested) {
      case SizeCategory.S:
        return [SizeCategory.S, SizeCategory.M, SizeCategory.L];
      case SizeCategory.M:
        return [SizeCategory.M, SizeCategory.L];
      case SizeCategory.L:
        return [SizeCategory.L];
    }
  }

  private sizePriority(candidate: SizeCategory, requested: SizeCategory): number {
    const order: Record<SizeCategory, SizeCategory[]> = {
      S: [SizeCategory.S, SizeCategory.M, SizeCategory.L],
      M: [SizeCategory.M, SizeCategory.L],
      L: [SizeCategory.L],
    };

    return order[requested].indexOf(candidate);
  }
}
