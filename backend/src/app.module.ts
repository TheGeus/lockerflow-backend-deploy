import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './common/prisma/prisma.module';
import { PeopleModule } from './modules/people/people.module';
import { LockersModule } from './modules/lockers/lockers.module';
import { PackagesModule } from './modules/packages/packages.module';
import { PickupModule } from './modules/pickup/pickup.module';
import { OverflowModule } from './modules/overflow/overflow.module';
import { IncidentsModule } from './modules/incidents/incidents.module';
import { AuditModule } from './modules/audit/audit.module';
import { AdminModule } from './modules/admin/admin.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    PeopleModule,
    LockersModule,
    PackagesModule,
    PickupModule,
    OverflowModule,
    IncidentsModule,
    AuditModule,
    AdminModule,
    HealthModule,
  ],
})
export class AppModule {}
