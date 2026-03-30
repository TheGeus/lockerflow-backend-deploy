import { IncidentStatus } from '@prisma/client';
import { IncidentsService } from '../src/modules/incidents/incidents.service';

describe('IncidentsService', () => {
  it('applies status and date range filters when listing incidents', async () => {
    const prisma = {
      incident: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any;

    const service = new IncidentsService(prisma);

    await service.list({
      status: IncidentStatus.OPEN,
      from: '2026-03-01',
      to: '2026-03-31',
    });

    expect(prisma.incident.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: IncidentStatus.OPEN,
          createdAt: {
            gte: new Date('2026-03-01T00:00:00.000Z'),
            lte: new Date('2026-03-31T23:59:59.999Z'),
          },
        },
      }),
    );
  });
});
