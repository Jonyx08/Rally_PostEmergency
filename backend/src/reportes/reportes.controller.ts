import { Body, Controller, DefaultValuePipe, Get, HttpCode, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ReportesService } from './reportes.service';

@ApiTags('reportes')
@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportes: ReportesService) {}

  @Post('sync')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Recibir un lote de reportes (PWA o mula de datos)',
    description:
      'Idempotente por id: reenviar el mismo lote no crea duplicados. ' +
      'Un reporte inválido se rechaza individualmente y aparece en "invalidos". ' +
      'Si hubo reportes nuevos, se recalcula el triaje.',
  })
  @ApiBody({
    schema: {
      example: {
        collectorId: 'patrulla-01',
        reportes: [
          {
            id: '5f0c2b9e-8a3d-4c1e-9b7a-2d6f1e0a4c33',
            deviceId: 'tel-ciudadano-123',
            createdAt: '2026-10-17T06:00:00Z',
            lat: 13.4833,
            lng: -88.1833,
            tipo: 'DERRUMBE',
            heridos: 2,
            personasAtrapadas: true,
            descripcion: 'Casa colapsada, se escuchan voces',
          },
        ],
      },
    },
  })
  sincronizar(@Body() cuerpo: unknown) {
    return this.reportes.sincronizar(cuerpo);
  }

  @Get()
  @ApiOperation({ summary: 'Últimos reportes individuales (para el mapa)' })
  @ApiQuery({ name: 'limite', required: false, example: 2000 })
  listar(@Query('limite', new DefaultValuePipe(2000), ParseIntPipe) limite: number) {
    return this.reportes.listar(Math.min(Math.max(limite, 1), 10000));
  }
}
