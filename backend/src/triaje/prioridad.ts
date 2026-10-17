import { NivelPrioridad, NivelRiesgo, TipoEmergencia } from '@prisma/client';
import { pesosPrioridad, umbralesNivel } from '../config';

export interface DatosIncidente {
  cantidadReportes: number;
  heridosEstimados: number;
  hayAtrapados: boolean;
  tipos: TipoEmergencia[];
  nivelZona: NivelRiesgo | null;
}

export interface DesglosePrioridad {
  reportes: number;
  heridos: number;
  atrapados: number;
  tipo: number;
  zonaRiesgo: number;
}

export interface ResultadoPrioridad {
  prioridad: number;
  nivelPrioridad: NivelPrioridad;
  desglose: DesglosePrioridad;
  tipoPrincipal: TipoEmergencia;
}

/** El tipo más grave del grupo según los pesos configurados. */
export function tipoMasGrave(tipos: TipoEmergencia[]): TipoEmergencia {
  if (tipos.length === 0) return 'OTRO';
  return tipos.reduce((peor, t) =>
    pesosPrioridad.tipo[t] > pesosPrioridad.tipo[peor] ? t : peor,
  );
}

export function nivelDesdePuntaje(puntaje: number): NivelPrioridad {
  if (puntaje >= umbralesNivel.CRITICA) return 'CRITICA';
  if (puntaje >= umbralesNivel.ALTA) return 'ALTA';
  if (puntaje >= umbralesNivel.MEDIA) return 'MEDIA';
  return 'BAJA';
}

/**
 * Calcula la prioridad (0-100) de un incidente y el aporte de cada factor.
 * Función pura: no toca la base de datos, así se puede probar fácilmente.
 */
export function calcularPrioridad(datos: DatosIncidente): ResultadoPrioridad {
  const p = pesosPrioridad;
  const tipoPrincipal = tipoMasGrave(datos.tipos);

  const desglose: DesglosePrioridad = {
    reportes: Math.min(p.maxReportes, datos.cantidadReportes * p.puntosPorReporte),
    heridos: Math.min(p.maxHeridos, datos.heridosEstimados * p.puntosPorHerido),
    atrapados: datos.hayAtrapados ? p.atrapados : 0,
    tipo: p.tipo[tipoPrincipal],
    zonaRiesgo: datos.nivelZona ? p.zona[datos.nivelZona] : 0,
  };

  const total = Object.values(desglose).reduce((a, b) => a + b, 0);
  const prioridad = Math.max(0, Math.min(100, Math.round(total)));

  return {
    prioridad,
    nivelPrioridad: nivelDesdePuntaje(prioridad),
    desglose,
    tipoPrincipal,
  };
}
