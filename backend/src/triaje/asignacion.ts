import { randomUUID } from 'node:crypto';

/** Una fila del resultado de ST_ClusterDBSCAN. */
export interface FilaCluster {
  reporteId: string;
  /** Incidente al que pertenecía el reporte antes de este recálculo (o null). */
  incidenteActual: string | null;
  /** Número de grupo que devolvió DBSCAN; null = "ruido" (no forma grupo). */
  cluster: number | null;
}

export interface ResultadoAsignacion {
  /** reporteId -> incidenteId (null si el reporte quedó como ruido). */
  asignaciones: Map<string, string | null>;
  /** Incidentes que no existían y hay que crear. */
  nuevos: Set<string>;
  /** Incidentes existentes que se conservan (con su estado). */
  conservados: Set<string>;
}

/**
 * Decide a qué incidente pertenece cada grupo de DBSCAN.
 *
 * DBSCAN numera los grupos de nuevo en cada ejecución, así que el número de
 * grupo no sirve como identificador estable. Para que un incidente conserve su
 * id y su estado (por ejemplo ASIGNADO) entre recálculos:
 *   - cada grupo reutiliza el incidente al que ya pertenecía la mayoría de sus reportes;
 *   - si dos grupos quieren el mismo incidente (el incidente se partió), se lo queda
 *     el grupo más grande y el otro recibe un incidente nuevo;
 *   - un grupo sin reportes previos recibe un incidente nuevo.
 *
 * Función pura (salvo randomUUID): no toca la base de datos.
 */
export function asignarIncidentes(
  filas: FilaCluster[],
  generarId: () => string = randomUUID,
): ResultadoAsignacion {
  const grupos = new Map<number, FilaCluster[]>();
  const asignaciones = new Map<string, string | null>();

  for (const fila of filas) {
    if (fila.cluster === null) {
      asignaciones.set(fila.reporteId, null);
      continue;
    }
    const grupo = grupos.get(fila.cluster) ?? [];
    grupo.push(fila);
    grupos.set(fila.cluster, grupo);
  }

  // Los grupos más grandes eligen primero.
  const ordenados = [...grupos.values()].sort((a, b) => b.length - a.length);
  const nuevos = new Set<string>();
  const conservados = new Set<string>();

  for (const grupo of ordenados) {
    const votos = new Map<string, number>();
    for (const f of grupo) {
      if (f.incidenteActual) votos.set(f.incidenteActual, (votos.get(f.incidenteActual) ?? 0) + 1);
    }
    const candidatos = [...votos.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([id]) => id);

    let incidenteId = candidatos.find((id) => !conservados.has(id));
    if (incidenteId) {
      conservados.add(incidenteId);
    } else {
      incidenteId = generarId();
      nuevos.add(incidenteId);
    }
    for (const f of grupo) asignaciones.set(f.reporteId, incidenteId);
  }

  return { asignaciones, nuevos, conservados };
}
