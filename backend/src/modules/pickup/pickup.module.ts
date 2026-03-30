import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { IncidentsModule } from '../incidents/incidents.module';
import { PickupController } from './pickup.controller';
import { PickupService } from './pickup.service';
import { MockLockerGateway } from 'src/integration/locker-gateway/mock-locker.gateway';

@Module({
  imports: [AuditModule, IncidentsModule],
  controllers: [PickupController],
  providers: [PickupService, MockLockerGateway],
})
export class PickupModule {}