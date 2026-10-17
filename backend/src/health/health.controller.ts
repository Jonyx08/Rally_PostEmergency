import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Comprueba que la API, la base de datos y PostGIS responden' })
  async estado() {
    try {
      const [fila] = await this.prisma.$queryRaw<{ postgis: string }[]>`SELECT postgis_lib_version() AS postgis`;
      return { api: 'ok', db: 'ok', postgis: fila?.postgis ?? null };
    } catch (e) {
      return { api: 'ok', db: 'error', detalle: (e as Error).message };
    }
  }
}
