import { AuditService } from '../src/modules/audit/audit.service';

describe('AuditService', () => {
  it('applies entity/date filters and constrains take when listing audit events', async () => {
    const prisma = {
      auditEvent: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any;

    const service = new AuditService(prisma);

    await service.list({
      entityType: 'PACKAGE',
      eventType: 'PACKAGE_ASSIGNED',
      from: '2026-03-01',
      to: '2026-03-31',
      take: '999',
    });

    expect(prisma.auditEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          entityType: 'PACKAGE',
          eventType: 'PACKAGE_ASSIGNED',
          createdAt: {
            gte: new Date('2026-03-01T00:00:00.000Z'),
            lte: new Date('2026-03-31T23:59:59.999Z'),
          },
        },
        take: 500,
      }),
    );
  });
});
