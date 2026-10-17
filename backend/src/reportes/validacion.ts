import { TipoEmergencia } from '@prisma/client';

export const TIPOS_EMERGENCIA: TipoEmergencia[] = [
  'DERRUMBE',
  'INUNDACION',
  'INCENDIO',
  'PERSONA_ATRAPADA',
  'HERIDOS',
  'OTRO',
];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reporte ya validado y normalizado, listo para insertar. */
export interface ReporteValido {
  id: string;
  deviceId: string;
  createdAt: Date;
  lat: number;
  lng: number;
  tipo: TipoEmergencia;
  heridos: number;
  personasAtrapadas: boolean;
  descripcion: string | null;
}

export type ResultadoValidacion =
  | { ok: true; reporte: ReporteValido }
  | { ok: false; id: string | null; error: string };

function esNumero(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

/**
 * Valida UN reporte del lote. Se valida reporte por reporte (y no el lote
 * completo) para que un reporte malo no haga fallar a todos los demás.
 */
export function validarReporte(entrada: unknown): ResultadoValidacion {
  if (typeof entrada !== 'object' || entrada === null || Array.isArray(entrada)) {
    return { ok: false, id: null, error: 'el reporte debe ser un objeto' };
  }
  const r = entrada as Record<string, unknown>;
  const id = typeof r.id === 'string' ? r.id : null;
  const falla = (error: string): ResultadoValidacion => ({ ok: false, id, error });

  if (!id || !UUID_REGEX.test(id)) return falla('id debe ser un UUID');
  if (typeof r.deviceId !== 'string' || r.deviceId.trim() === '' || r.deviceId.length > 100) {
    return falla('deviceId es obligatorio (texto de hasta 100 caracteres)');
  }
  if (typeof r.createdAt !== 'string' || Number.isNaN(Date.parse(r.createdAt))) {
    return falla('createdAt debe ser una fecha ISO 8601');
  }
  if (!esNumero(r.lat) || r.lat < -90 || r.lat > 90) return falla('lat fuera de rango');
  if (!esNumero(r.lng) || r.lng < -180 || r.lng > 180) return falla('lng fuera de rango');
  if (typeof r.tipo !== 'string' || !TIPOS_EMERGENCIA.includes(r.tipo as TipoEmergencia)) {
    return falla(`tipo debe ser uno de: ${TIPOS_EMERGENCIA.join(', ')}`);
  }
  if (!Number.isInteger(r.heridos) || (r.heridos as number) < 0 || (r.heridos as number) > 10000) {
    return falla('heridos debe ser un entero >= 0');
  }
  if (typeof r.personasAtrapadas !== 'boolean') {
    return falla('personasAtrapadas debe ser true o false');
  }
  if (r.descripcion !== undefined && r.descripcion !== null) {
    if (typeof r.descripcion !== 'string') return falla('descripcion debe ser texto');
    if (r.descripcion.length > 280) return falla('descripcion supera 280 caracteres');
  }

  return {
    ok: true,
    reporte: {
      id: id.toLowerCase(),
      deviceId: r.deviceId.trim(),
      createdAt: new Date(r.createdAt),
      lat: r.lat,
      lng: r.lng,
      tipo: r.tipo as TipoEmergencia,
      heridos: r.heridos as number,
      personasAtrapadas: r.personasAtrapadas,
      descripcion: typeof r.descripcion === 'string' && r.descripcion.trim() !== '' ? r.descripcion.trim() : null,
    },
  };
}
