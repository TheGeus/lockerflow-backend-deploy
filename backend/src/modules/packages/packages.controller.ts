import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RegisterPackageDto } from './dto/register-package.dto';
import { PackagesService } from './packages.service';

@UseGuards(JwtAuthGuard)
@Controller('packages')
export class PackagesController {
  constructor(private readonly packagesService: PackagesService) {}

  @Post('register')
  register(
    @Body() dto: RegisterPackageDto,
    @CurrentUser() user: { userId: string },
  ) {
    return this.packagesService.registerPackage(dto, BigInt(user.userId));
  }

  @Post(':packageId/confirm-deposit')
  confirmDeposit(
    @Param('packageId') packageId: string,
    @CurrentUser() user: { userId: string },
  ) {
    return this.packagesService.confirmDeposit(BigInt(packageId), BigInt(user.userId));
  }

  @Get(':packageId')
  getById(@Param('packageId') packageId: string) {
    return this.packagesService.getById(BigInt(packageId));
  }

  @Get()
  list(
    @Query('status') status?: string,
    @Query('trackingNumber') trackingNumber?: string,
    @Query('personName') personName?: string,
    @Query('lockerId') lockerId?: string,
  ) {
    return this.packagesService.list({
      status,
      trackingNumber,
      personName,
      lockerId,
    });
  }
}
