import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { AuditService } from './audit.service';

@Roles('ADMIN')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('audit-events')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  list(
    @Query('entityType') entityType?: string,
    @Query('eventType') eventType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('take') take?: string,
  ) {
    return this.auditService.list({
      entityType,
      eventType,
      from,
      to,
      take,
    });
  }
}
