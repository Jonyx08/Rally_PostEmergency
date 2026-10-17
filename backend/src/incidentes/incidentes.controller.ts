import { BadRequestException, Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { EstadoIncidente } from '@prisma/client';
import { ESTADOS, IncidentesService } from './incidentes.service';

function validarEstado(valor: unknown): EstadoIncidente {
  if (typeof valor !== 'string' || !ESTADOS.includes(valor as EstadoIncidente)) {
    throw new BadRequestException(`estado debe ser uno de: ${ESTADOS.join(', ')}`);
  }
  return valor as EstadoIncidente;
}

@ApiTags('incidentes')
@Controller('incidentes')
export class IncidentesController {
  constructor(private readonly incidentes: IncidentesService) {}

  @Get()
  @ApiOperation({ summary: 'Incidentes ordenados por prioridad (mayor primero)' })
  @ApiQuery({ name: 'estado', required: false, enum: ESTADOS })
  listar(@Query('estado') estado?: string) {
    return this.incidentes.listar(estado ? validarEstado(estado) : undefined);
  }

  @Get('resumen')
  @ApiOperation({ summary: 'Totales para el tablero: reportes, incidentes por nivel y por estado' })
  resumen() {
    return this.incidentes.resumen();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un incidente con sus reportes' })
  detalle(@Param('id', ParseUUIDPipe) id: string) {
    return this.incidentes.detalle(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cambiar el estado de un incidente (NUEVO, ASIGNADO, ATENDIDO)' })
  @ApiBody({ schema: { example: { estado: 'ASIGNADO' } } })
  cambiarEstado(@Param('id', ParseUUIDPipe) id: string, @Body() cuerpo: { estado?: unknown }) {
    return this.incidentes.cambiarEstado(id, validarEstado(cuerpo?.estado));
  }
}
