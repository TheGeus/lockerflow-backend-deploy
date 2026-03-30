import { CompartmentStatus, OverflowStatus, PackageStatus, SizeCategory } from '@prisma/client';
import { OverflowService } from '../src/modules/overflow/overflow.service';

describe('OverflowService', () => {
  const auditService = { log: jest.fn().mockResolvedValue(undefined) } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('reassigns an overflow package when a compatible slot becomes available', async () => {
    const tx: any = {
      overflowItem: {
        findUnique: jest.fn().mockResolvedValue({
          id: 501n,
          status: OverflowStatus.WAITING,
          package: { id: 201n, sizeCategory: SizeCategory.M, status: PackageStatus.OVERFLOW },
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      compartment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 11n,
            lockerId: 2n,
            slotNumber: 2,
            sizeCategory: SizeCategory.M,
            status: CompartmentStatus.LIBRE,
            locker: { code: 'LKR-B' },
          },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      package: {
        update: jest.fn().mockResolvedValue({}),
      },
    };

    const prisma = { $transaction: jest.fn((cb: any) => cb(tx)) } as any;
    const service = new OverflowService(prisma, auditService);

    const result = await service.retryAssignment(501n, 1n);

    expect(result.status).toBe(OverflowStatus.REASSIGNED);
    expect(result.compartment.lockerCode).toBe('LKR-B');
    expect(tx.package.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: PackageStatus.ASSIGNED,
          assignedCompartmentId: 11n,
        }),
      }),
    );
  });

  it('rejects an overflow package in a controlled way', async () => {
    const tx: any = {
      overflowItem: {
        findUnique: jest.fn().mockResolvedValue({
          id: 502n,
          status: OverflowStatus.WAITING,
          package: { id: 202n, status: PackageStatus.OVERFLOW },
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      package: {
        update: jest.fn().mockResolvedValue({}),
      },
    };

    const prisma = { $transaction: jest.fn((cb: any) => cb(tx)) } as any;
    const service = new OverflowService(prisma, auditService);

    const result = await service.reject(502n, 1n, 'Cliente pidió rechazo');

    expect(result.status).toBe(OverflowStatus.REJECTED);
    expect(tx.package.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: PackageStatus.CANCELLED,
          overflowReason: 'REJECTED_BY_ADMIN',
        }),
      }),
    );
  });
});
