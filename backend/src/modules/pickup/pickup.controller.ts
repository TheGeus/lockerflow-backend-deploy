import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { AttemptPickupDto } from './dto/attempt-pickup.dto';
import { PickupService } from './pickup.service';

@UseGuards(JwtAuthGuard)
@Controller('packages')
export class PickupController {
  constructor(private readonly pickupService: PickupService) {}

  @Post(':packageId/attempt-pickup')
  attemptPickup(
    @Param('packageId') packageId: string,
    @Body() dto: AttemptPickupDto,
    @CurrentUser() user: { userId: string },
  ) {
    return this.pickupService.attemptPickup(BigInt(packageId), dto.pickupCode, BigInt(user.userId));
  }

  @Post(':packageId/confirm-retrieval')
  confirmRetrieval(
    @Param('packageId') packageId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.pickupService.confirmRetrieval(BigInt(packageId), BigInt(user.userId));
  }
}