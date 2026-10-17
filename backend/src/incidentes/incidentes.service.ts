import { Injectable, NotFoundException } from '@nestjs/common';
import { EstadoIncidente, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const incluirZona = {
  zonaRiesgo: { select: { id: true, nombre: true, nivel: true } },
} satisfies Prisma.IncidenteInclude;

type IncidenteConZona = Prisma.IncidenteGetPayload<{ include: typeof incluirZona }>;

/** Da al incidente la forma del contrato de docs/API.md. */
function aContrato(i: IncidenteConZona) {
  return {
    id: i.id,
    lat: i.lat,
    lng: i.lng,
    radioMetros: i.radioMetros,
    cantidadReportes: i.cantidadReportes,
    heridosEstimados: i.heridosEstimados,
    hayAtrapados: i.hayAtrapados,
    tipoPrincipal: i.tipoPrincipal,
    prioridad: i.prioridad,
    nivelPrioridad: i.nivelPrioridad,
    desglosePrioridad: i.desglosePrioridad,
    zonaRiesgo: i.zonaRiesgo,
    estado: i.estado,
    creadoEn: i.creadoEn,
    actualizadoEn: i.actualizadoEn,
  };
}

export const ESTADOS: EstadoIncidente[] = ['NUEVO', 'ASIGNADO', 'ATENDIDO'];

@Injectable()
export class IncidentesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(estado?: EstadoIncidente) {
    const incidentes = await this.prisma.incidente.findMany({
      where: estado ? { estado } : undefined,
      orderBy: [{ prioridad: 'desc' }, { cantidadReportes: 'desc' }, { creadoEn: 'asc' }],
      include: incluirZona,
    });
    return incidentes.map(aContrato);
  }

  async detalle(id: string) {
    const incidente = await this.prisma.incidente.findUnique({
      where: { id },
      include: {
        ...incluirZona,
        reportes: {
          orderBy: { creadoEn: 'asc' },
          select: {
            id: true,
            deviceId: true,
            creadoEn: true,
            recibidoEn: true,
            lat: true,
            lng: true,
            tipo: true,
            heridos: true,
            personasAtrapadas: true,
            descripcion: true,
            collectorId: true,
          },
        },
      },
    });
    if (!incidente) throw new NotFoundException('Incidente no encontrado');
    return {
      ...aContrato(incidente),
      reportes: incidente.reportes.map(({ creadoEn, ...r }) => ({ ...r, createdAt: creadoEn })),
    };
  }

  async cambiarEstado(id: string, estado: EstadoIncidente) {
    const existe = await this.prisma.incidente.findUnique({ where: { id }, select: { id: true } });
    if (!existe) throw new NotFoundException('Incidente no encontrado');
    const incidente = await this.prisma.incidente.update({
      where: { id },
      data: { estado },
      include: incluirZona,
    });
    return aContrato(incidente);
  }

  /** Números generales para la cabecera del tablero. */
  async resumen() {
    const [reportes, porNivel, porEstado] = await Promise.all([
      this.prisma.reporte.count(),
      this.prisma.incidente.groupBy({ by: ['nivelPrioridad'], _count: { _all: true } }),
      this.prisma.incidente.groupBy({ by: ['estado'], _count: { _all: true } }),
    ]);
    const nivel = { CRITICA: 0, ALTA: 0, MEDIA: 0, BAJA: 0 };
    for (const n of porNivel) nivel[n.nivelPrioridad] = n._count._all;
    const estados = { NUEVO: 0, ASIGNADO: 0, ATENDIDO: 0 };
    for (const e of porEstado) estados[e.estado] = e._count._all;
    const incidentes = Object.values(nivel).reduce((a, b) => a + b, 0);
    return { reportes, incidentes, porNivel: nivel, porEstado: estados };
  }
}
