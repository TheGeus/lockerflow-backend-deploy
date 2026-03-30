import { IsNotEmpty, IsString } from 'class-validator';

export class AttemptPickupDto {
  @IsString()
  @IsNotEmpty()
  pickupCode!: string;
}