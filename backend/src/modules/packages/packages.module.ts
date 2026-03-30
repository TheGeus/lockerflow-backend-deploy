import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { PackagesController } from './packages.controller';
import { PackagesService } from './packages.service';

@Module({
  imports: [AuditModule],
  controllers: [PackagesController],
  providers: [PackagesService],
})
export class PackagesModule {}