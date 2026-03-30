import { ConflictException } from '@nestjs/common';
import { CompartmentStatus, PackageStatus, PickupAttemptStatus } from '@prisma/client';
import { PickupService } from '../src/modules/pickup/pickup.service';

describe('PickupService', () => {
  const auditService = { log: jest.fn().mockResolvedValue(undefined) } as any;
  const incidentsService = { create: jest.fn().mockResolvedValue({ id: 900n }) } as any;
  const lockerGateway = { authorizeOpen: jest.fn() } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('authorizes pickup and moves package to retrieval in progress', async () => {
    const tx: any = {
      package: {
        findUnique: jest.fn().mockResolvedValue({
          id: 300n,
          status: PackageStatus.STORED,
          assignedCompartment: {
            id: 20n,
            lockerId: 2n,
            status: CompartmentStatus.OCUPADO,
            locker: { id: 2n, code: 'LKR-B' },
          },
          pickupCode: {
            id: 700n,
            code: 'CODE99',
            usedAt: null,
            revokedAt: null,
            expiresAt: new Date(Date.now() + 60000),
          },
        }),
        update: jest.fn().mockResolvedValue({ id: 300n, status: PackageStatus.RETRIEVAL_IN_PROGRESS }),
      },
      pickupAttempt: { create: jest.fn().mockResolvedValue({ id: 800n }) },
      pickupCode: { update: jest.fn().mockResolvedValue({}) },
    };

    lockerGateway.authorizeOpen.mockResolvedValue({ ok: true, mode: 'MOCK' });

    const prisma = { $transaction: jest.fn((cb: any) => cb(tx)) } as any;
    const service = new PickupService(prisma, auditService, incidentsService, lockerGateway);

    const result = await service.attemptPickup(300n, 'CODE99', 9n);

    expect(result.openResult).toBe('AUTHORIZED');
    expect(result.status).toBe(PackageStatus.RETRIEVAL_IN_PROGRESS);
    expect(tx.pickupAttempt.create).toHaveBeenCalled();
    expect(incidentsService.create).not.toHaveBeenCalled();
  });

  it('confirms retrieval and frees the compartment', async () => {
    const tx: any = {
      package: {
        findUnique: jest.fn().mockResolvedValue({
          id: 301n,
          status: PackageStatus.RETRIEVAL_IN_PROGRESS,
          assignedCompartment: { id: 21n, status: CompartmentStatus.OCUPADO },
          pickupCode: { id: 701n },
          pickupAttempts: [{ id: 801n, status: PickupAttemptStatus.AUTHORIZED }],
        }),
        update: jest.fn().mockResolvedValue({ id: 301n, status: PackageStatus.RETRIEVED }),
      },
      pickupCode: { update: jest.fn().mockResolvedValue({}) },
      pickupAttempt: { update: jest.fn().mockResolvedValue({}) },
      compartment: { update: jest.fn().mockResolvedValue({}) },
    };

    const prisma = { $transaction: jest.fn((cb: any) => cb(tx)) } as any;
    const service = new PickupService(prisma, auditService, incidentsService, lockerGateway);

    const result = await service.confirmRetrieval(301n, 4n);

    expect(result.status).toBe(PackageStatus.RETRIEVED);
    expect(result.compartmentStatus).toBe(CompartmentStatus.LIBRE);
    expect(tx.compartment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: CompartmentStatus.LIBRE, reservedForPackageId: null }),
      }),
    );
    expect(auditService.log).toHaveBeenCalledWith('PACKAGE', 301n, 'PACKAGE_RETRIEVED', expect.any(Object), 4n, tx);
  });

  it('rejects expired pickup codes without authorizing opening', async () => {
    const tx: any = {
      package: {
        findUnique: jest.fn().mockResolvedValue({
          id: 302n,
          status: PackageStatus.STORED,
          assignedCompartment: {
            id: 22n,
            lockerId: 2n,
            status: CompartmentStatus.OCUPADO,
            locker: { id: 2n, code: 'LKR-B' },
          },
          pickupCode: {
            id: 702n,
            code: 'EXPIRE',
            usedAt: null,
            revokedAt: null,
            expiresAt: new Date(Date.now() - 60000),
          },
        }),
      },
      pickupAttempt: { create: jest.fn() },
      pickupCode: { update: jest.fn() },
    };

    const prisma = { $transaction: jest.fn((cb: any) => cb(tx)) } as any;
    const service = new PickupService(prisma, auditService, incidentsService, lockerGateway);

    await expect(service.attemptPickup(302n, 'EXPIRE', 9n)).rejects.toThrow(ConflictException);
    expect(lockerGateway.authorizeOpen).not.toHaveBeenCalled();
    expect(tx.pickupAttempt.create).not.toHaveBeenCalled();
  });

  it('rejects already used pickup codes without opening the locker', async () => {
    const tx: any = {
      package: {
        findUnique: jest.fn().mockResolvedValue({
          id: 303n,
          status: PackageStatus.STORED,
          assignedCompartment: {
            id: 23n,
            lockerId: 2n,
            status: CompartmentStatus.OCUPADO,
            locker: { id: 2n, code: 'LKR-B' },
          },
          pickupCode: {
            id: 703n,
            code: 'USED01',
            usedAt: new Date(),
            revokedAt: null,
            expiresAt: new Date(Date.now() + 60000),
          },
        }),
      },
      pickupAttempt: { create: jest.fn() },
      pickupCode: { update: jest.fn() },
    };

    const prisma = { $transaction: jest.fn((cb: any) => cb(tx)) } as any;
    const service = new PickupService(prisma, auditService, incidentsService, lockerGateway);

    await expect(service.attemptPickup(303n, 'USED01', 9n)).rejects.toThrow(ConflictException);
    expect(lockerGateway.authorizeOpen).not.toHaveBeenCalled();
    expect(tx.pickupCode.update).not.toHaveBeenCalled();
  });

  it('increments attempts and rejects invalid pickup codes', async () => {
    const tx: any = {
      package: {
        findUnique: jest.fn().mockResolvedValue({
          id: 304n,
          status: PackageStatus.STORED,
          assignedCompartment: {
            id: 24n,
            lockerId: 2n,
            status: CompartmentStatus.OCUPADO,
            locker: { id: 2n, code: 'LKR-B' },
          },
          pickupCode: {
            id: 704n,
            code: 'VALID1',
            usedAt: null,
            revokedAt: null,
            expiresAt: new Date(Date.now() + 60000),
          },
        }),
      },
      pickupAttempt: { create: jest.fn() },
      pickupCode: { update: jest.fn().mockResolvedValue({}) },
    };

    const prisma = { $transaction: jest.fn((cb: any) => cb(tx)) } as any;
    const service = new PickupService(prisma, auditService, incidentsService, lockerGateway);

    await expect(service.attemptPickup(304n, 'BAD999', 9n)).rejects.toThrow(ConflictException);
    expect(tx.pickupCode.update).toHaveBeenCalledWith({
      where: { id: 704n },
      data: { attemptCount: { increment: 1 } },
    });
    expect(lockerGateway.authorizeOpen).not.toHaveBeenCalled();
  });
});
