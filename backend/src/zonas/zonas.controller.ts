import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('zonas-riesgo')
@Controller('zonas-riesgo')
export class ZonasController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Zonas de riesgo como GeoJSON FeatureCollection (coordenadas [lng, lat])' })
  async listar() {
    const filas = await this.prisma.$queryRaw<
      { id: string; nombre: string; nivel: string; geometria: unknown }[]
    >`SELECT id, nombre, nivel::text AS nivel, ST_AsGeoJSON(area)::json AS geometria
      FROM zonas_riesgo ORDER BY id`;
    return {
      type: 'FeatureCollection',
      features: filas.map((z) => ({
        type: 'Feature',
        properties: { id: z.id, nombre: z.nombre, nivel: z.nivel },
        geometry: z.geometria,
      })),
    };
  }
}
