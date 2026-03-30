import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { OverflowController } from './overflow.controller';
import { OverflowService } from './overflow.service';

@Module({
  imports: [AuditModule],
  controllers: [OverflowController],
  providers: [OverflowService],
})
export class OverflowModule {}
