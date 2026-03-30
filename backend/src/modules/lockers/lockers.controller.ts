import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { LockersService } from './lockers.service';

@Roles('ADMIN')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class LockersController {
  constructor(private readonly lockersService: LockersService) {}

  @Get('lockers')
  listLockers() {
    return this.lockersService.listLockers();
  }

  @Get('lockers/:lockerId')
  getLocker(@Param('lockerId') lockerId: string) {
    return this.lockersService.getLocker(BigInt(lockerId));
  }

  @Get('compartments')
  listCompartments(
    @Query('lockerId') lockerId?: string,
    @Query('status') status?: string,
    @Query('sizeCategory') sizeCategory?: string,
  ) {
    return this.lockersService.listCompartments(lockerId, status, sizeCategory);
  }
}