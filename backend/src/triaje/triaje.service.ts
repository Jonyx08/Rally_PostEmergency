import { Injectable, Logger } from '@nestjs/common';
import { NivelRiesgo, Prisma, TipoEmergencia } from '@prisma/client';
import { configTriaje } from '../config';
import { PrismaService } from '../prisma/prisma.service';
import { asignarIncidentes, FilaCluster } from './asignacion';
import { calcularPrioridad } from './prioridad';

/** Número arbitrario para el candado de Postgres: evita dos recálculos simultáneos. */
const CANDADO_TRIAJE = 9042026;

interface AgregadoIncidente {
  incidente_id: string;
  cantidad: number;
  heridos: number;
  atrapados: boolean;
  tipos: TipoEmergencia[];
  lat: number;
  lng: number;
  radio: number;
  zona_id: string | null;
  zona_nivel: NivelRiesgo | null;
}

export interface ResumenTriaje {
  incidentes: number;
  nuevos: number;
  actualizados: number;
  eliminados: number;
  reportesSinIncidente: number;
}

@Injectable()
export class TriajeService {
  private readonly logger = new Logger(TriajeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recalcula todos los incidentes a partir de todos los reportes:
   *   1. Agrupa los reportes cercanos con ST_ClusterDBSCAN (distancias en metros).
   *   2. Decide qué incidente le toca a cada grupo, conservando ids y estados.
   *   3. Calcula los agregados de cada incidente (centro, radio, heridos, zona de riesgo).
   *   4. Calcula la prioridad y guarda todo.
   *
   * Recalcular todo en cada sincronización es simple y suficiente para el volumen
   * de una demo (miles de reportes). Para producción habría que hacerlo incremental.
   */
  async recalcular(): Promise<ResumenTriaje> {
    const inicio = Date.now();
    const resumen = await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${CANDADO_TRIAJE})`;

        // 1. Clustering espacial. Se transforma a UTM 16N para que eps esté en metros.
        const filas = await tx.$queryRaw<{ id: string; incidente_id: string | null; cluster: number | null }[]>`
          SELECT r.id::text AS id,
                 r.incidente_id::text AS incidente_id,
                 ST_ClusterDBSCAN(
                   ST_Transform(r.ubicacion, ${configTriaje.sridMetrico}::int),
                   eps := ${configTriaje.radioMetros}::float8,
                   minpoints := ${configTriaje.minReportes}::int
                 ) OVER () AS cluster
          FROM reportes r
          WHERE r.ubicacion IS NOT NULL`;

        // 2. Asignación estable de incidentes.
        const { asignaciones, nuevos } = asignarIncidentes(
          filas.map<FilaCluster>((f) => ({
            reporteId: f.id,
            incidenteActual: f.incidente_id,
            cluster: f.cluster === null ? null : Number(f.cluster),
          })),
        );

        const conIncidente = [...asignaciones.entries()].filter(
          (e): e is [string, string] => e[1] !== null,
        );
        const reporteIds = conIncidente.map(([r]) => r);
        const incidenteIds = conIncidente.map(([, i]) => i);

        // 3. Agregados por incidente (en SQL, porque necesita PostGIS).
        const agregados =
          reporteIds.length === 0
            ? []
            : await tx.$queryRaw<AgregadoIncidente[]>`
          WITH m AS (
            SELECT * FROM unnest(${reporteIds}::uuid[], ${incidenteIds}::uuid[]) AS m(rid, inc)
          ),
          g AS (
            SELECT m.inc,
                   count(*)::int                      AS cantidad,
                   max(r.heridos)::int                AS heridos,  -- máximo, no suma (ver schema.prisma)
                   bool_or(r.personas_atrapadas)      AS atrapados,
                   array_agg(DISTINCT r.tipo::text)   AS tipos,
                   ST_Centroid(ST_Collect(r.ubicacion)) AS centro
            FROM m JOIN reportes r ON r.id = m.rid
            GROUP BY m.inc
          )
          SELECT g.inc::text AS incidente_id,
                 g.cantidad, g.heridos, g.atrapados, g.tipos,
                 ST_Y(g.centro) AS lat,
                 ST_X(g.centro) AS lng,
                 COALESCE((
                   SELECT max(ST_Distance(r.ubicacion::geography, g.centro::geography))
                   FROM m JOIN reportes r ON r.id = m.rid
                   WHERE m.inc = g.inc
                 ), 0)::float8 AS radio,
                 z.id AS zona_id,
                 z.nivel::text AS zona_nivel
          FROM g
          LEFT JOIN LATERAL (
            SELECT zr.id, zr.nivel
            FROM zonas_riesgo zr
            WHERE ST_Intersects(zr.area, g.centro)
            ORDER BY CASE zr.nivel WHEN 'ROJO' THEN 1 WHEN 'NARANJA' THEN 2 ELSE 3 END
            LIMIT 1
          ) z ON true`;

        // 4. Prioridad y guardado.
        const existentes = new Map(
          (
            await tx.incidente.findMany({
              where: { id: { in: incidenteIds.length ? [...new Set(incidenteIds)] : [] } },
              select: { id: true, estado: true, cantidadReportes: true },
            })
          ).map((i) => [i.id, i]),
        );

        let actualizados = 0;
        const porCrear: Prisma.IncidenteCreateManyInput[] = [];

        for (const a of agregados) {
          const p = calcularPrioridad({
            cantidadReportes: a.cantidad,
            heridosEstimados: a.heridos,
            hayAtrapados: a.atrapados,
            tipos: a.tipos,
            nivelZona: a.zona_nivel,
          });
          const datos = {
            lat: a.lat,
            lng: a.lng,
            radioMetros: Math.round(a.radio * 10) / 10,
            cantidadReportes: a.cantidad,
            heridosEstimados: a.heridos,
            hayAtrapados: a.atrapados,
            tipoPrincipal: p.tipoPrincipal,
            prioridad: p.prioridad,
            nivelPrioridad: p.nivelPrioridad,
            desglosePrioridad: p.desglose as unknown as Prisma.InputJsonValue,
            zonaRiesgoId: a.zona_id,
          };

          const previo = existentes.get(a.incidente_id);
          if (previo && !nuevos.has(a.incidente_id)) {
            // Si llegan reportes nuevos a un incidente ya atendido, se reabre.
            const reabrir = previo.estado === 'ATENDIDO' && a.cantidad > previo.cantidadReportes;
            await tx.incidente.update({
              where: { id: a.incidente_id },
              data: { ...datos, ...(reabrir ? { estado: 'NUEVO' as const } : {}) },
            });
            actualizados++;
          } else {
            porCrear.push({ id: a.incidente_id, ...datos });
          }
        }

        if (porCrear.length > 0) await tx.incidente.createMany({ data: porCrear });

        // Asignar cada reporte a su incidente (o a ninguno, si quedó como ruido).
        const todosIds = [...asignaciones.keys()];
        const todosInc = todosIds.map((r) => asignaciones.get(r) ?? null);
        if (todosIds.length > 0) {
          await tx.$executeRaw`
            UPDATE reportes AS r
            SET incidente_id = m.inc
            FROM unnest(${todosIds}::uuid[], ${todosInc}::uuid[]) AS m(rid, inc)
            WHERE r.id = m.rid AND r.incidente_id IS DISTINCT FROM m.inc`;
        }

        const eliminados = await tx.$executeRaw`
          DELETE FROM incidentes i
          WHERE NOT EXISTS (SELECT 1 FROM reportes r WHERE r.incidente_id = i.id)`;

        return {
          incidentes: agregados.length,
          nuevos: porCrear.length,
          actualizados,
          eliminados: Number(eliminados),
          reportesSinIncidente: todosInc.filter((i) => i === null).length,
        };
      },
      { timeout: 60_000, maxWait: 30_000 },
    );

    this.logger.log(
      `Triaje recalculado en ${Date.now() - inicio} ms: ${resumen.incidentes} incidentes ` +
        `(${resumen.nuevos} nuevos, ${resumen.actualizados} actualizados, ${resumen.eliminados} eliminados)`,
    );
    return resumen;
  }
}
