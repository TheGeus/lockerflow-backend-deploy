import { PrismaClient, EmployeeRole, IntegrationType, CompartmentStatus, SizeCategory } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const adminPasswordHash = await bcrypt.hash('admin123', 10);
  const operatorPasswordHash = await bcrypt.hash('secret123', 10);

  const admin = await prisma.employee.upsert({
    where: { username: 'admin' },
    update: { passwordHash: adminPasswordHash, role: EmployeeRole.ADMIN, active: true },
    create: { username: 'admin', passwordHash: adminPasswordHash, role: EmployeeRole.ADMIN, active: true },
  });

  await prisma.employee.upsert({
    where: { username: 'operador1' },
    update: { passwordHash: operatorPasswordHash, role: EmployeeRole.EMPLOYEE, active: true },
    create: { username: 'operador1', passwordHash: operatorPasswordHash, role: EmployeeRole.EMPLOYEE, active: true },
  });

  await prisma.person.upsert({
    where: { externalQrId: 'QR-0001' },
    update: { fullName: 'Ana Pérez', documentId: '12345678A', phone: '+34111111111', email: 'ana@example.com' },
    create: { externalQrId: 'QR-0001', fullName: 'Ana Pérez', documentId: '12345678A', phone: '+34111111111', email: 'ana@example.com' },
  });

  await prisma.person.upsert({
    where: { externalQrId: 'QR-0002' },
    update: { fullName: 'Luis Gómez', documentId: '87654321B', phone: '+34222222222', email: 'luis@example.com' },
    create: { externalQrId: 'QR-0002', fullName: 'Luis Gómez', documentId: '87654321B', phone: '+34222222222', email: 'luis@example.com' },
  });

  const lockerA = await prisma.locker.upsert({
    where: { code: 'LKR-A' },
    update: { name: 'Locker A', location: 'Recepción Planta 1', integrationType: IntegrationType.MOCK, active: true },
    create: { code: 'LKR-A', name: 'Locker A', location: 'Recepción Planta 1', integrationType: IntegrationType.MOCK, active: true },
  });

  const lockerB = await prisma.locker.upsert({
    where: { code: 'LKR-B' },
    update: { name: 'Locker B', location: 'Recepción Planta 2', integrationType: IntegrationType.MOCK, active: true },
    create: { code: 'LKR-B', name: 'Locker B', location: 'Recepción Planta 2', integrationType: IntegrationType.MOCK, active: true },
  });

  const compartments = [
    { lockerId: lockerA.id, slotNumber: 1, sizeCategory: SizeCategory.S, status: CompartmentStatus.LIBRE },
    { lockerId: lockerA.id, slotNumber: 2, sizeCategory: SizeCategory.S, status: CompartmentStatus.LIBRE },
    { lockerId: lockerA.id, slotNumber: 3, sizeCategory: SizeCategory.M, status: CompartmentStatus.LIBRE },
    { lockerId: lockerA.id, slotNumber: 4, sizeCategory: SizeCategory.L, status: CompartmentStatus.LIBRE },
    { lockerId: lockerB.id, slotNumber: 1, sizeCategory: SizeCategory.S, status: CompartmentStatus.LIBRE },
    { lockerId: lockerB.id, slotNumber: 2, sizeCategory: SizeCategory.M, status: CompartmentStatus.BLOQUEADO },
    { lockerId: lockerB.id, slotNumber: 3, sizeCategory: SizeCategory.L, status: CompartmentStatus.AVERIADO },
  ];

  for (const compartment of compartments) {
    await prisma.compartment.upsert({
      where: {
        lockerId_slotNumber: {
          lockerId: compartment.lockerId,
          slotNumber: compartment.slotNumber,
        },
      },
      update: {
        sizeCategory: compartment.sizeCategory,
        status: compartment.status,
        reservedForPackageId: null,
      },
      create: compartment,
    });
  }

  console.log('Seed completado. Admin ID:', admin.id.toString());
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
