import { CompartmentStatus, PackageStatus, SizeCategory } from '@prisma/client';
import { PackagesService } from '../src/modules/packages/packages.service';

describe('PackagesService', () => {
  const auditService = { log: jest.fn().mockResolvedValue(undefined) } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('assigns the best compatible free compartment and creates pickup code', async () => {
    const tx: any = {
      person: { upsert: jest.fn().mockResolvedValue({ id: 10n }) },
      package: {
        create: jest.fn().mockResolvedValue({ id: 100n }),
        update: jest.fn().mockResolvedValue({ id: 100n, status: PackageStatus.ASSIGNED }),
      },
      compartment: {
        findMany: jest.fn().mockResolvedValue([
          { id: 1n, lockerId: 1n, slotNumber: 1, sizeCategory: SizeCategory.L, status: CompartmentStatus.LIBRE, locker: { id: 1n, code: 'LKR-A' } },
          { id: 2n, lockerId: 1n, slotNumber: 2, sizeCategory: SizeCategory.M, status: CompartmentStatus.LIBRE, locker: { id: 1n, code: 'LKR-A' } },
        ]),
        updateMany: jest.fn().mockResolvedValueOnce({ count: 1 }),
      },
      pickupCode: {
        create: jest.fn().mockResolvedValue({ id: 999n, code: 'ABC123', expiresAt: new Date('2026-03-29T10:00:00Z') }),
      },
      overflowItem: { create: jest.fn() },
    };

    const prisma = { $transaction: jest.fn((cb: any) => cb(tx)) } as any;
    const service = new PackagesService(prisma, auditService);
    jest.spyOn(service as any, 'generatePickupCode').mockReturnValue('ABC123');

    const result = await service.registerPackage(
      {
        person: { externalQrId: 'QR-1', fullName: 'Ana' },
        package: { trackingNumber: 'PKG-1', sizeCategory: 'M', weightGrams: 100 },
      } as any,
      5n,
    );

    expect(result.status).toBe('ASSIGNED');
    expect(result.compartment).toBeDefined();
    expect(result.compartment!.id).toBe('2');
    expect(tx.overflowItem.create).not.toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith('PACKAGE', 100n, 'PACKAGE_ASSIGNED', expect.any(Object), 5n, tx);
  });

  it('sends the package to overflow when there is no compatible free compartment', async () => {
    const tx: any = {
      person: { upsert: jest.fn().mockResolvedValue({ id: 10n }) },
      package: {
        create: jest.fn().mockResolvedValue({ id: 101n }),
        update: jest.fn().mockResolvedValue({ id: 101n, status: PackageStatus.OVERFLOW }),
      },
      compartment: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn() },
      pickupCode: { create: jest.fn() },
      overflowItem: {
        create: jest.fn().mockResolvedValue({ id: 500n, reason: 'NO_COMPATIBLE_SLOT_AVAILABLE', status: 'WAITING' }),
      },
    };

    const prisma = { $transaction: jest.fn((cb: any) => cb(tx)) } as any;
    const service = new PackagesService(prisma, auditService);

    const result = await service.registerPackage(
      {
        person: { externalQrId: 'QR-2', fullName: 'Luis' },
        package: { trackingNumber: 'PKG-2', sizeCategory: 'L', weightGrams: 300 },
      } as any,
      8n,
    );

    expect(result.status).toBe('OVERFLOW');
    expect(result.overflow).toBeDefined();
    expect(result.overflow!.id).toBe('500');
    expect(tx.pickupCode.create).not.toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith('PACKAGE', 101n, 'PACKAGE_OVERFLOW', expect.any(Object), 8n, tx);
  });

  it('skips a compartment that was already reserved concurrently and assigns the next free candidate', async () => {
    const tx: any = {
      person: { upsert: jest.fn().mockResolvedValue({ id: 10n }) },
      package: {
        create: jest.fn().mockResolvedValue({ id: 102n }),
        update: jest.fn().mockResolvedValue({ id: 102n, status: PackageStatus.ASSIGNED }),
      },
      compartment: {
        findMany: jest.fn().mockResolvedValue([
          { id: 3n, lockerId: 1n, slotNumber: 3, sizeCategory: SizeCategory.S, status: CompartmentStatus.LIBRE, locker: { id: 1n, code: 'LKR-A' } },
          { id: 4n, lockerId: 1n, slotNumber: 4, sizeCategory: SizeCategory.S, status: CompartmentStatus.LIBRE, locker: { id: 1n, code: 'LKR-A' } },
        ]),
        updateMany: jest
          .fn()
          .mockResolvedValueOnce({ count: 0 })
          .mockResolvedValueOnce({ count: 1 }),
      },
      pickupCode: {
        create: jest.fn().mockResolvedValue({ id: 1000n, code: '654321', expiresAt: new Date('2026-03-29T10:00:00Z') }),
      },
      overflowItem: { create: jest.fn() },
    };

    const prisma = { $transaction: jest.fn((cb: any) => cb(tx)) } as any;
    const service = new PackagesService(prisma, auditService);
    jest.spyOn(service as any, 'generatePickupCode').mockReturnValue('654321');

    const result = await service.registerPackage(
      {
        person: { externalQrId: 'QR-3', fullName: 'Marta' },
        package: { trackingNumber: 'PKG-3', sizeCategory: 'S', weightGrams: 50 },
      } as any,
      9n,
    );

    expect(tx.compartment.updateMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ id: 3n, status: CompartmentStatus.LIBRE }),
      }),
    );
    expect(tx.compartment.updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({ id: 4n, status: CompartmentStatus.LIBRE }),
      }),
    );
    expect(result.status).toBe('ASSIGNED');
    expect(result.compartment!.id).toBe('4');
    expect(tx.overflowItem.create).not.toHaveBeenCalled();
    expect(auditService.log).toHaveBeenCalledWith('PACKAGE', 102n, 'PACKAGE_ASSIGNED', expect.any(Object), 9n, tx);
  });

  it('applies package list filters for status, tracking number, person name and locker id', async () => {
    const prisma = {
      package: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any;

    const service = new PackagesService(prisma, auditService);

    await service.list({
      status: PackageStatus.STORED,
      trackingNumber: 'PKG-44',
      personName: 'Ana',
      lockerId: '7',
    });

    expect(prisma.package.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: PackageStatus.STORED,
          trackingNumber: {
            contains: 'PKG-44',
            mode: 'insensitive',
          },
          person: {
            fullName: {
              contains: 'Ana',
              mode: 'insensitive',
            },
          },
          assignedCompartment: {
            lockerId: 7n,
          },
        },
      }),
    );
  });
});
