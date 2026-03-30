import { Injectable } from '@nestjs/common';
import { IncidentStatus, IncidentType, Prisma } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';

@Injectable()
export class IncidentsService {
  constructor(private readonly prisma: PrismaService) {}

  create(
    data: {
      lockerId?: bigint;
      compartmentId?: bigint;
      packageId?: bigint;
      type: IncidentType;
      message: string;
    },
    client?: Prisma.TransactionClient,
  ) {
    const db = client ?? this.prisma;
    return db.incident.create({
      data: {
        lockerId: data.lockerId,
        compartmentId: data.compartmentId,
        packageId: data.packageId,
        type: data.type,
        status: IncidentStatus.OPEN,
        message: data.message,
      },
    });
  }

  async list(filters?: {
    status?: string;
    from?: string;
    to?: string;
  }) {
    const where: Prisma.IncidentWhereInput = {
      ...(filters?.status ? { status: filters.status as IncidentStatus } : {}),
      ...(filters?.from || filters?.to
        ? {
            createdAt: {
              ...(filters?.from ? { gte: new Date(`${filters.from}T00:00:00.000Z`) } : {}),
              ...(filters?.to ? { lte: new Date(`${filters.to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    };

    const rows = await this.prisma.incident.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => ({
      id: row.id.toString(),
      lockerId: row.lockerId?.toString() ?? null,
      compartmentId: row.compartmentId?.toString() ?? null,
      packageId: row.packageId?.toString() ?? null,
      type: row.type,
      status: row.status,
      message: row.message,
      createdAt: row.createdAt.toISOString(),
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
    }));
  }

  async resolve(incidentId: bigint) {
    const row = await this.prisma.incident.update({
      where: { id: incidentId },
      data: { status: IncidentStatus.RESOLVED, resolvedAt: new Date() },
    });

    return {
      id: row.id.toString(),
      status: row.status,
      resolvedAt: row.resolvedAt?.toISOString() ?? null,
    };
  }
}
