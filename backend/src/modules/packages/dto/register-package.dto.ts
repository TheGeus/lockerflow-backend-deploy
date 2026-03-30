import { Type } from 'class-transformer';
import { IsEmail, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

class PersonPayloadDto {
  @IsString()
  @IsNotEmpty()
  externalQrId!: string;

  @IsOptional()
  @IsString()
  documentId?: string;

  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}

class PackagePayloadDto {
  @IsString()
  @IsNotEmpty()
  trackingNumber!: string;

  @IsIn(['S', 'M', 'L'])
  sizeCategory!: 'S' | 'M' | 'L';

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weightGrams?: number;
}

export class RegisterPackageDto {
  @ValidateNested()
  @Type(() => PersonPayloadDto)
  person!: PersonPayloadDto;

  @ValidateNested()
  @Type(() => PackagePayloadDto)
  package!: PackagePayloadDto;
}