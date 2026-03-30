import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { randomInt } from 'crypto';
import {
  Compartment,
  CompartmentStatus,
  PackageStatus,
  Prisma,
  PrismaClient,
  SizeCategory,
} from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RegisterPackageDto } from './dto/register-package.dto';

@Injectable()
export class PackagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async registerPackage(dto: RegisterPackageDto, employeeId: bigint) {
    return this.prisma.$transaction(async (tx) => {
      const person = await tx.person.upsert({
        where: { externalQrId: dto.person.externalQrId },
        update: {
          documentId: dto.person.documentId,
          fullName: dto.person.fullName,
          phone: dto.person.phone,
          email: dto.person.email,
        },
        create: {
          externalQrId: dto.person.externalQrId,
          documentId: dto.person.documentId,
          fullName: dto.person.fullName,
          phone: dto.person.phone,
          email: dto.person.email,
        },
      });

      const pkg = await tx.package.create({
        data: {
          trackingNumber: dto.package.trackingNumber,
          personId: person.id,
          sizeCategory: dto.package.sizeCategory,
          weightGrams: dto.package.weightGrams,
          status: PackageStatus.PENDING_ASSIGNMENT,
          createdByEmployeeId: employeeId,
        },
      });

      const candidates = await tx.compartment.findMany({
        where: {
          status: CompartmentStatus.LIBRE,
          sizeCategory: { in: this.compatibleSizes(dto.package.sizeCategory) },
        },
        orderBy: [{ lockerId: 'asc' }, { slotNumber: 'asc' }],
        include: { locker: true },
      });

      const sortedCandidates = candidates.sort(
        (a, b) => this.sizePriority(a.sizeCategory, dto.package.sizeCategory) - this.sizePriority(b.sizeCategory, dto.package.sizeCategory),
      );

      for (const candidate of sortedCandidates) {
        const updated = await tx.compartment.updateMany({
          where: {
            id: candidate.id,
            status: CompartmentStatus.LIBRE,
          },
          data: {
            status: CompartmentStatus.RESERVADO,
            reservedForPackageId: pkg.id,
            lastStatusChangeAt: new Date(),
          },
        });

        if (updated.count === 1) {
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
          const pickupCode = await this.createUniquePickupCode(tx, pkg.id, expiresAt);

          await tx.package.update({
            where: { id: pkg.id },
            data: {
              status: PackageStatus.ASSIGNED,
              assignedCompartmentId: candidate.id,
            },
          });

          await this.auditService.log(
            'PACKAGE',
            pkg.id,
            'PACKAGE_ASSIGNED',
            {
              lockerId: candidate.lockerId.toString(),
              compartmentId: candidate.id.toString(),
              sizeCategory: candidate.sizeCategory,
              pickupCodeId: pickupCode.id.toString(),
            },
            employeeId,
            tx,
          );

          return {
            packageId: pkg.id.toString(),
            status: 'ASSIGNED',
            locker: {
              id: candidate.locker.id.toString(),
              code: candidate.locker.code,
            },
            compartment: {
              id: candidate.id.toString(),
              slotNumber: candidate.slotNumber,
              sizeCategory: candidate.sizeCategory,
              status: 'RESERVADO',
            },
            pickupCode: {
              code: pickupCode.code,
              expiresAt: pickupCode.expiresAt.toISOString(),
            },
          };
        }
      }

      const overflow = await tx.overflowItem.create({
        data: {
          packageId: pkg.id,
          reason: 'NO_COMPATIBLE_SLOT_AVAILABLE',
          status: 'WAITING',
        },
      });

      await tx.package.update({
        where: { id: pkg.id },
        data: {
          status: PackageStatus.OVERFLOW,
          overflowReason: 'NO_COMPATIBLE_SLOT_AVAILABLE',
        },
      });

      await this.auditService.log(
        'PACKAGE',
        pkg.id,
        'PACKAGE_OVERFLOW',
        { overflowId: overflow.id.toString(), reason: overflow.reason },
        employeeId,
        tx,
      );

      return {
        packageId: pkg.id.toString(),
        status: 'OVERFLOW',
        overflow: {
          id: overflow.id.toString(),
          reason: overflow.reason,
          status: overflow.status,
        },
        suggestedActions: ['WAIT', 'RETRY_LATER', 'REJECT_CONTROLLED'],
      };
    });
  }

  async confirmDeposit(packageId: bigint, employeeId: bigint) {
    return this.prisma.$transaction(async (tx) => {
      const pkg = await tx.package.findUnique({
        where: { id: packageId },
        include: { assignedCompartment: true },
      });

      if (!pkg || !pkg.assignedCompartmentId || !pkg.assignedCompartment) {
        throw new NotFoundException('Paquete no encontrado o sin hueco asignado');
      }

      if (pkg.status !== PackageStatus.ASSIGNED) {
        throw new ConflictException('El paquete no esta listo para confirmar deposito');
      }

      if (pkg.assignedCompartment.status !== CompartmentStatus.RESERVADO) {
        throw new ConflictException('El hueco asignado no esta reservado');
      }

      await tx.compartment.update({
        where: { id: pkg.assignedCompartment.id },
        data: {
          status: CompartmentStatus.OCUPADO,
          lastStatusChangeAt: new Date(),
        },
      });

      const updated = await tx.package.update({
        where: { id: packageId },
        data: { status: PackageStatus.STORED },
      });

      await this.auditService.log(
        'PACKAGE',
        packageId,
        'PACKAGE_DEPOSIT_CONFIRMED',
        { compartmentId: pkg.assignedCompartment.id.toString() },
        employeeId,
        tx,
      );

      return {
        packageId: updated.id.toString(),
        status: updated.status,
        compartmentId: pkg.assignedCompartment.id.toString(),
      };
    });
  }

  async getById(packageId: bigint) {
    const pkg = await this.prisma.package.findUnique({
      where: { id: packageId },
      include: {
        person: true,
        assignedCompartment: { include: { locker: true } },
        pickupCode: true,
        overflowItem: true,
      },
    });

    if (!pkg) {
      throw new NotFoundException('Paquete no encontrado');
    }

    return {
      id: pkg.id.toString(),
      trackingNumber: pkg.trackingNumber,
      status: pkg.status,
      person: {
        id: pkg.person.id.toString(),
        externalQrId: pkg.person.externalQrId,
        fullName: pkg.person.fullName,
      },
      compartment: pkg.assignedCompartment
        ? {
            id: pkg.assignedCompartment.id.toString(),
            slotNumber: pkg.assignedCompartment.slotNumber,
            status: pkg.assignedCompartment.status,
            locker: {
              id: pkg.assignedCompartment.locker.id.toString(),
              code: pkg.assignedCompartment.locker.code,
            },
          }
        : null,
      pickupCode: pkg.pickupCode
        ? {
            code: pkg.pickupCode.code,
            expiresAt: pkg.pickupCode.expiresAt.toISOString(),
            usedAt: pkg.pickupCode.usedAt?.toISOString() ?? null,
          }
        : null,
      overflow: pkg.overflowItem
        ? {
            id: pkg.overflowItem.id.toString(),
            reason: pkg.overflowItem.reason,
            status: pkg.overflowItem.status,
          }
        : null,
    };
  }

  async list(filters?: {
    status?: string;
    trackingNumber?: string;
    personName?: string;
    lockerId?: string;
  }) {
    const where: Prisma.PackageWhereInput = {
      ...(filters?.status ? { status: filters.status as PackageStatus } : {}),
      ...(filters?.trackingNumber
        ? {
            trackingNumber: {
              contains: filters.trackingNumber.trim(),
              mode: 'insensitive',
            },
          }
        : {}),
      ...(filters?.personName
        ? {
            person: {
              fullName: {
                contains: filters.personName.trim(),
                mode: 'insensitive',
              },
            },
          }
        : {}),
      ...(filters?.lockerId
        ? {
            assignedCompartment: {
              lockerId: BigInt(filters.lockerId),
            },
          }
        : {}),
    };

    const rows = await this.prisma.package.findMany({
      where,
      include: {
        person: true,
        assignedCompartment: { include: { locker: true } },
        overflowItem: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((pkg) => ({
      id: pkg.id.toString(),
      trackingNumber: pkg.trackingNumber,
      status: pkg.status,
      sizeCategory: pkg.sizeCategory,
      personName: pkg.person.fullName,
      compartment: pkg.assignedCompartment
        ? {
            id: pkg.assignedCompartment.id.toString(),
            slotNumber: pkg.assignedCompartment.slotNumber,
            lockerCode: pkg.assignedCompartment.locker.code,
            status: pkg.assignedCompartment.status,
          }
        : null,
      overflow: pkg.overflowItem
        ? {
            id: pkg.overflowItem.id.toString(),
            status: pkg.overflowItem.status,
            reason: pkg.overflowItem.reason,
          }
        : null,
      createdAt: pkg.createdAt.toISOString(),
    }));
  }
  private compatibleSizes(requested: 'S' | 'M' | 'L'): SizeCategory[] {
    switch (requested) {
      case 'S':
        return [SizeCategory.S, SizeCategory.M, SizeCategory.L];
      case 'M':
        return [SizeCategory.M, SizeCategory.L];
      case 'L':
        return [SizeCategory.L];
    }
  }

  private sizePriority(candidate: SizeCategory, requested: 'S' | 'M' | 'L'): number {
    const order: Record<'S' | 'M' | 'L', SizeCategory[]> = {
      S: [SizeCategory.S, SizeCategory.M, SizeCategory.L],
      M: [SizeCategory.M, SizeCategory.L],
      L: [SizeCategory.L],
    };

    return order[requested].indexOf(candidate);
  }

  private generatePickupCode() {
    const value = randomInt(0, 1_000_000);
    return value.toString().padStart(6, '0');
  }

  private async createUniquePickupCode(tx: Prisma.TransactionClient, packageId: bigint, expiresAt: Date) {
    const maxAttempts = 5;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        return await tx.pickupCode.create({
          data: {
            packageId,
            code: this.generatePickupCode(),
            expiresAt,
          },
        });
      } catch (error) {
        if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
          continue;
        }

        throw error;
      }
    }

    throw new ConflictException('No se pudo generar un pickup code unico');
  }
}
