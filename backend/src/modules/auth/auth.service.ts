import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const employee = await this.prisma.employee.findUnique({
      where: { username: dto.username },
    });

    if (!employee || !employee.active) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    const passwordOk = await bcrypt.compare(dto.password, employee.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    const accessToken = await this.jwtService.signAsync({
      sub: employee.id.toString(),
      username: employee.username,
      role: employee.role,
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      employee: {
        id: employee.id.toString(),
        username: employee.username,
        role: employee.role,
      },
    };
  }
}