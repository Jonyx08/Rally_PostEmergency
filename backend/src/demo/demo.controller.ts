import { Controller, Delete, ForbiddenException } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Solo para la demo: borra reportes e incidentes (conserva las zonas de riesgo)
 * para empezar la presentación con el tablero vacío.
 * Se habilita únicamente con DEMO_PERMITIR_RESET=true en el .env.
 */
@ApiTags('demo')
@Controller('demo')
export class DemoController {
  constructor(private readonly prisma: PrismaService) {}

  @Delete('datos')
  @ApiOperation({ summary: 'Borrar reportes e incidentes (requiere DEMO_PERMITIR_RESET=true)' })
  async reiniciar() {
    if (process.env.DEMO_PERMITIR_RESET !== 'true') {
      throw new ForbiddenException('Reinicio deshabilitado. Activa DEMO_PERMITIR_RESET=true en el .env');
    }
    const [reportes, incidentes] = await this.prisma.$transaction([
      this.prisma.reporte.deleteMany(),
      this.prisma.incidente.deleteMany(),
    ]);
    return { reportesBorrados: reportes.count, incidentesBorrados: incidentes.count };
  }
}
