import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/common/prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    entityType: string,
    entityId: bigint,
    eventType: string,
    payload: Prisma.InputJsonValue = {},
    performedByEmployeeId?: bigint,
    client?: Prisma.TransactionClient,
  ) {
    const db = client ?? this.prisma;

    return db.auditEvent.create({
      data: {
        entityType,
        entityId,
        eventType,
        payloadJson: payload,
        performedByEmployeeId,
      },
    });
  }

  async list(filters?: {
    entityType?: string;
    eventType?: string;
    from?: string;
    to?: string;
    take?: string;
  }) {
    const where: Prisma.AuditEventWhereInput = {
      ...(filters?.entityType ? { entityType: filters.entityType } : {}),
      ...(filters?.eventType ? { eventType: filters.eventType } : {}),
      ...(filters?.from || filters?.to
        ? {
            createdAt: {
              ...(filters?.from ? { gte: new Date(`${filters.from}T00:00:00.000Z`) } : {}),
              ...(filters?.to ? { lte: new Date(`${filters.to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    };

    const takeValue = filters?.take ? Number(filters.take) : 200;
    const safeTake = Number.isFinite(takeValue) ? Math.min(Math.max(takeValue, 1), 500) : 200;

    const rows = await this.prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: safeTake,
    });

    return rows.map((row) => ({
      id: row.id.toString(),
      entityType: row.entityType,
      entityId: row.entityId.toString(),
      eventType: row.eventType,
      performedByEmployeeId: row.performedByEmployeeId?.toString() ?? null,
      payloadJson: row.payloadJson,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
