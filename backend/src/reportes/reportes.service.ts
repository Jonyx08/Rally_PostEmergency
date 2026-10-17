import { BadRequestException, Injectable } from '@nestjs/common';
import { MAX_REPORTES_POR_LOTE } from '../config';
import { PrismaService } from '../prisma/prisma.service';
import { ResumenTriaje, TriajeService } from '../triaje/triaje.service';
import { ReporteValido, validarReporte } from './validacion';

export interface ResultadoSync {
  insertados: number;
  duplicados: number;
  invalidos: { id: string | null; error: string }[];
  /** Resumen del recálculo de incidentes (null si no hubo reportes nuevos). */
  triaje: ResumenTriaje | null;
}

@Injectable()
export class ReportesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly triaje: TriajeService,
  ) {}

  /**
   * Recibe un lote de reportes (de la PWA o de una mula de datos).
   * - Idempotente: un reporte cuyo id ya existe se ignora y cuenta como duplicado.
   * - Un reporte inválido se rechaza solo; el resto del lote se procesa igual.
   */
  async sincronizar(cuerpo: unknown): Promise<ResultadoSync> {
    if (typeof cuerpo !== 'object' || cuerpo === null || Array.isArray(cuerpo)) {
      throw new BadRequestException('El cuerpo debe ser un objeto { collectorId, reportes }');
    }
    const { collectorId, reportes } = cuerpo as { collectorId?: unknown; reportes?: unknown };

    if (collectorId !== undefined && collectorId !== null) {
      if (typeof collectorId !== 'string' || collectorId.length === 0 || collectorId.length > 100) {
        throw new BadRequestException('collectorId debe ser texto (hasta 100 caracteres) o null');
      }
    }
    if (!Array.isArray(reportes)) {
      throw new BadRequestException('reportes debe ser un arreglo');
    }
    if (reportes.length > MAX_REPORTES_POR_LOTE) {
      throw new BadRequestException(`Máximo ${MAX_REPORTES_POR_LOTE} reportes por lote`);
    }

    const invalidos: ResultadoSync['invalidos'] = [];
    const validos = new Map<string, ReporteValido>();
    let duplicadosEnLote = 0;

    for (const entrada of reportes) {
      const r = validarReporte(entrada);
      if (!r.ok) {
        invalidos.push({ id: r.id, error: r.error });
      } else if (validos.has(r.reporte.id)) {
        duplicadosEnLote++;
      } else {
        validos.set(r.reporte.id, r.reporte);
      }
    }

    const lista = [...validos.values()];
    const insertados = lista.length === 0 ? 0 : await this.insertar(lista, (collectorId as string | null) ?? null);
    const duplicados = lista.length - insertados + duplicadosEnLote;
    const triaje = insertados > 0 ? await this.triaje.recalcular() : null;

    return { insertados, duplicados, invalidos, triaje };
  }

  /** Inserta en un solo INSERT ... ON CONFLICT DO NOTHING y devuelve cuántos eran nuevos. */
  private async insertar(lista: ReporteValido[], collectorId: string | null): Promise<number> {
    const filas = await this.prisma.$queryRaw<{ id: string }[]>`
      INSERT INTO reportes
        (id, device_id, creado_en, lat, lng, ubicacion, tipo, heridos, personas_atrapadas, descripcion, collector_id)
      SELECT d.id, d.device_id, d.creado_en, d.lat, d.lng,
             ST_SetSRID(ST_MakePoint(d.lng, d.lat), 4326),
             d.tipo::"TipoEmergencia", d.heridos, d.atrapados, d.descripcion, ${collectorId}
      FROM unnest(
        ${lista.map((r) => r.id)}::uuid[],
        ${lista.map((r) => r.deviceId)}::text[],
        ${lista.map((r) => r.createdAt.toISOString())}::timestamptz[],
        ${lista.map((r) => r.lat)}::float8[],
        ${lista.map((r) => r.lng)}::float8[],
        ${lista.map((r) => r.tipo)}::text[],
        ${lista.map((r) => r.heridos)}::int[],
        ${lista.map((r) => r.personasAtrapadas)}::bool[],
        ${lista.map((r) => r.descripcion)}::text[]
      ) AS d(id, device_id, creado_en, lat, lng, tipo, heridos, atrapados, descripcion)
      ON CONFLICT (id) DO NOTHING
      RETURNING id`;
    return filas.length;
  }

  /** Reportes individuales (para pintar los puntos en el mapa). */
  async listar(limite: number) {
    const reportes = await this.prisma.reporte.findMany({
      take: limite,
      orderBy: { recibidoEn: 'desc' },
      select: {
        id: true,
        lat: true,
        lng: true,
        tipo: true,
        heridos: true,
        personasAtrapadas: true,
        incidenteId: true,
        collectorId: true,
        creadoEn: true,
        recibidoEn: true,
      },
    });
    return reportes.map(({ creadoEn, ...r }) => ({ ...r, createdAt: creadoEn }));
  }
}
