import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { UpsertPersonDto } from './dto/upsert-person.dto';
import { PeopleService } from './people.service';

@UseGuards(JwtAuthGuard)
@Controller('people')
export class PeopleController {
  constructor(private readonly peopleService: PeopleService) {}

  @Get('by-qr/:externalQrId')
  findByQr(@Param('externalQrId') externalQrId: string) {
    return this.peopleService.findByQr(externalQrId);
  }

  @Post()
  create(@Body() dto: UpsertPersonDto) {
    return this.peopleService.create(dto);
  }

  @Patch(':personId')
  update(@Param('personId') personId: string, @Body() dto: UpsertPersonDto) {
    return this.peopleService.update(BigInt(personId), dto);
  }
}
