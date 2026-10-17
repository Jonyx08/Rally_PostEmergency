import { NivelRiesgo, TipoEmergencia } from '@prisma/client';

/**
 * Parámetros del triaje. Todo lo que el equipo quiera ajustar está aquí.
 * Los valores numéricos son una propuesta inicial, no algo validado con expertos.
 */

function numeroEnv(nombre: string, porDefecto: number): number {
  const valor = Number(process.env[nombre]);
  return Number.isFinite(valor) && valor > 0 ? valor : porDefecto;
}

export const configTriaje = {
  /** Distancia máxima (m) entre dos reportes para que caigan en el mismo incidente (eps de DBSCAN). */
  get radioMetros(): number {
    return numeroEnv('TRIAJE_RADIO_METROS', 100);
  },
  /** Mínimo de reportes para formar un grupo (minpoints de DBSCAN). 1 = un reporte aislado también es incidente. */
  get minReportes(): number {
    return numeroEnv('TRIAJE_MIN_REPORTES', 1);
  },
  /**
   * SRID métrico usado para medir distancias: UTM zona 16N, que cubre El Salvador.
   * Los puntos se guardan en 4326 (grados) y se transforman a este SRID solo para el clustering.
   */
  sridMetrico: 32616,
};

/**
 * Pesos de la prioridad (0-100). La suma de los máximos es exactamente 100.
 *   reportes   : hasta 20  (2 puntos por reporte)
 *   heridos    : hasta 25  (3 puntos por herido)
 *   atrapados  : 20 si algún reporte indica personas atrapadas
 *   tipo       : hasta 15  (el tipo más grave del grupo)
 *   zonaRiesgo : hasta 20  (según el nivel de la zona donde cae el incidente)
 */
export const pesosPrioridad = {
  puntosPorReporte: 2,
  maxReportes: 20,
  puntosPorHerido: 3,
  maxHeridos: 25,
  atrapados: 20,
  tipo: {
    PERSONA_ATRAPADA: 15,
    DERRUMBE: 12,
    INCENDIO: 12,
    HERIDOS: 10,
    INUNDACION: 8,
    OTRO: 3,
  } satisfies Record<TipoEmergencia, number>,
  zona: {
    ROJO: 20,
    NARANJA: 12,
    AMARILLO: 6,
  } satisfies Record<NivelRiesgo, number>,
};

/** Umbrales para convertir el puntaje en un nivel. */
export const umbralesNivel = {
  CRITICA: 75,
  ALTA: 50,
  MEDIA: 25,
};

/** Límite de reportes por lote en /api/reportes/sync. */
export const MAX_REPORTES_POR_LOTE = 5000;
