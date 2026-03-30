import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { RejectOverflowDto } from './dto/reject-overflow.dto';
import { OverflowService } from './overflow.service';

@Roles('ADMIN')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('overflow')
export class OverflowController {
  constructor(private readonly overflowService: OverflowService) {}

  @Get()
  list(@Query('status') status?: string) {
    return this.overflowService.list(status);
  }

  @Post(':overflowId/retry-assignment')
  retryAssignment(
    @Param('overflowId') overflowId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.overflowService.retryAssignment(BigInt(overflowId), BigInt(user.userId));
  }

  @Post(':overflowId/reject')
  reject(
    @Param('overflowId') overflowId: string,
    @Body() dto: RejectOverflowDto,
    @CurrentUser() user: { userId: string },
  ) {
    return this.overflowService.reject(BigInt(overflowId), BigInt(user.userId), dto.notes);
  }
}
