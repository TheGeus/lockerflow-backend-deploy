import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectOverflowDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}
