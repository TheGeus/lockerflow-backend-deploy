import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { UpsertPersonDto } from './dto/upsert-person.dto';

@Injectable()
export class PeopleService {
  constructor(private readonly prisma: PrismaService) {}

  async findByQr(externalQrId: string) {
    const person = await this.prisma.person.findUnique({ where: { externalQrId } });
    return person ? this.toResponse(person) : null;
  }

  async create(dto: UpsertPersonDto) {
    const person = await this.prisma.person.create({
      data: {
        externalQrId: dto.externalQrId,
        documentId: dto.documentId,
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email,
      },
    });

    return this.toResponse(person);
  }

  async update(personId: bigint, dto: UpsertPersonDto) {
    const existing = await this.prisma.person.findUnique({ where: { id: personId } });
    if (!existing) {
      throw new NotFoundException('Persona no encontrada');
    }

    const person = await this.prisma.person.update({
      where: { id: personId },
      data: {
        externalQrId: dto.externalQrId,
        documentId: dto.documentId,
        fullName: dto.fullName,
        phone: dto.phone,
        email: dto.email,
      },
    });

    return this.toResponse(person);
  }

  private toResponse(person: {
    id: bigint;
    externalQrId: string;
    documentId: string | null;
    fullName: string;
    phone: string | null;
    email: string | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    return {
      id: person.id.toString(),
      externalQrId: person.externalQrId,
      documentId: person.documentId,
      fullName: person.fullName,
      phone: person.phone,
      email: person.email,
      createdAt: person.createdAt.toISOString(),
      updatedAt: person.updatedAt.toISOString(),
    };
  }
}