import { IsEmail, IsOptional, IsString } from 'class-validator';

export class UpsertPersonDto {
  @IsString()
  externalQrId!: string;

  @IsOptional()
  @IsString()
  documentId?: string;

  @IsString()
  fullName!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
