import { Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { IncidentsService } from './incidents.service';

@Roles('ADMIN')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('incidents')
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @Get()
  list(
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.incidentsService.list({ status, from, to });
  }

  @Post(':incidentId/resolve')
  resolve(@Param('incidentId') incidentId: string) {
    return this.incidentsService.resolve(BigInt(incidentId));
  }
}
