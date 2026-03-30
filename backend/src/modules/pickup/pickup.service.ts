import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CompartmentStatus, IncidentType, PackageStatus, PickupAttemptStatus } from '@prisma/client';
import { MockLockerGateway } from 'src/integration/locker-gateway/mock-locker.gateway';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { IncidentsService } from '../incidents/incidents.service';

@Injectable()
export class PickupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly incidentsService: IncidentsService,
    private readonly lockerGateway: MockLockerGateway,
  ) {}

  async attemptPickup(packageId: bigint, providedCode: string, employeeId: bigint) {
    return this.prisma.$transaction(async (tx) => {
      const pkg = await tx.package.findUnique({
        where: { id: packageId },
        include: {
          assignedCompartment: { include: { locker: true } },
          pickupCode: true,
        },
      });

      if (!pkg || !pkg.assignedCompartment || !pkg.pickupCode) {
        throw new NotFoundException('Paquete no encontrado o sin pickup code');
      }

      if (pkg.status !== PackageStatus.STORED) {
        throw new ConflictException('El paquete no esta disponible para recogida');
      }

      if (pkg.assignedCompartment.status !== CompartmentStatus.OCUPADO) {
        throw new ConflictException('El hueco no esta ocupado');
      }

      if (pkg.pickupCode.usedAt) {
        throw new ConflictException('El pickup code ya fue utilizado');
      }

      if (pkg.pickupCode.revokedAt) {
        throw new ConflictException('El pickup code fue revocado');
      }

      if (pkg.pickupCode.code !== providedCode) {
        await tx.pickupCode.update({
          where: { id: pkg.pickupCode.id },
          data: { attemptCount: { increment: 1 } },
        });
        throw new ConflictException('Pickup code invalido');
      }

      if (pkg.pickupCode.expiresAt.getTime() < Date.now()) {
        throw new ConflictException('Pickup code expirado');
      }

      const gatewayResult = await this.lockerGateway.authorizeOpen(
        pkg.assignedCompartment.lockerId,
        pkg.assignedCompartment.id,
        'pickup',
      );

      if (!gatewayResult.ok) {
        const attempt = await tx.pickupAttempt.create({
          data: {
            packageId: pkg.id,
            compartmentId: pkg.assignedCompartment.id,
            requestedByEmployeeId: employeeId,
            providedCode,
            gatewayMode: 'MOCK',
            status: PickupAttemptStatus.FAILED,
            errorMessage: gatewayResult.errorMessage ?? 'Open authorization failed',
          },
        });

        const incident = await this.incidentsService.create(
          {
            lockerId: pkg.assignedCompartment.lockerId,
            compartmentId: pkg.assignedCompartment.id,
            packageId: pkg.id,
            type: IncidentType.OPEN_FAILURE,
            message: gatewayResult.errorMessage ?? 'Open authorization failed',
          },
          tx,
        );

        await this.auditService.log(
          'PACKAGE',
          pkg.id,
          'PICKUP_OPEN_FAILED',
          {
            attemptId: attempt.id.toString(),
            incidentId: incident.id.toString(),
          },
          employeeId,
          tx,
        );

        return {
          packageId: pkg.id.toString(),
          status: pkg.status,
          openResult: 'FAILED',
          incidentId: incident.id.toString(),
        };
      }

      const attempt = await tx.pickupAttempt.create({
        data: {
          packageId: pkg.id,
          compartmentId: pkg.assignedCompartment.id,
          requestedByEmployeeId: employeeId,
          providedCode,
          gatewayMode: 'MOCK',
          status: PickupAttemptStatus.AUTHORIZED,
        },
      });

      await tx.package.update({
        where: { id: pkg.id },
        data: { status: PackageStatus.RETRIEVAL_IN_PROGRESS },
      });

      await tx.pickupCode.update({
        where: { id: pkg.pickupCode.id },
        data: { attemptCount: { increment: 1 } },
      });

      await this.auditService.log(
        'PACKAGE',
        pkg.id,
        'PICKUP_OPEN_AUTHORIZED',
        {
          attemptId: attempt.id.toString(),
          compartmentId: pkg.assignedCompartment.id.toString(),
        },
        employeeId,
        tx,
      );

      return {
        packageId: pkg.id.toString(),
        status: PackageStatus.RETRIEVAL_IN_PROGRESS,
        openResult: 'AUTHORIZED',
        gatewayMode: 'MOCK',
      };
    });
  }

  async confirmRetrieval(packageId: bigint, employeeId: bigint) {
    return this.prisma.$transaction(async (tx) => {
      const pkg = await tx.package.findUnique({
        where: { id: packageId },
        include: {
          assignedCompartment: true,
          pickupCode: true,
          pickupAttempts: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      if (!pkg || !pkg.assignedCompartment || !pkg.pickupCode) {
        throw new NotFoundException('Paquete no encontrado o inconsistente');
      }

      if (pkg.status !== PackageStatus.RETRIEVAL_IN_PROGRESS) {
        throw new ConflictException('El paquete no esta en retirada');
      }

      if (pkg.assignedCompartment.status !== CompartmentStatus.OCUPADO) {
        throw new ConflictException('El hueco no esta listo para liberarse');
      }

      const lastAttempt = pkg.pickupAttempts[0];
      if (!lastAttempt || lastAttempt.status !== PickupAttemptStatus.AUTHORIZED) {
        throw new ConflictException('No existe una apertura autorizada valida');
      }

      await tx.pickupCode.update({
        where: { id: pkg.pickupCode.id },
        data: { usedAt: new Date() },
      });

      await tx.pickupAttempt.update({
        where: { id: lastAttempt.id },
        data: { status: PickupAttemptStatus.CONFIRMED },
      });

      await tx.compartment.update({
        where: { id: pkg.assignedCompartment.id },
        data: {
          status: CompartmentStatus.LIBRE,
          reservedForPackageId: null,
          lastStatusChangeAt: new Date(),
        },
      });

      await tx.package.update({
        where: { id: pkg.id },
        data: { status: PackageStatus.RETRIEVED },
      });

      await this.auditService.log(
        'PACKAGE',
        pkg.id,
        'PACKAGE_RETRIEVED',
        {
          compartmentId: pkg.assignedCompartment.id.toString(),
          pickupAttemptId: lastAttempt.id.toString(),
        },
        employeeId,
        tx,
      );

      return {
        packageId: pkg.id.toString(),
        status: PackageStatus.RETRIEVED,
        compartmentId: pkg.assignedCompartment.id.toString(),
        compartmentStatus: CompartmentStatus.LIBRE,
      };
    });
  }
}