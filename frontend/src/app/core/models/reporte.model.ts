export type TipoEmergencia =
  | 'DERRUMBE'
  | 'INUNDACION'
  | 'INCENDIO'
  | 'PERSONA_ATRAPADA'
  | 'HERIDOS'
  | 'OTRO';

export type EstadoReporteLocal = 'PENDIENTE' | 'SINCRONIZADO' | 'ERROR';

export interface ReporteItem {
  id: string; // UUID v4 generado en el dispositivo (clave de idempotencia)
  deviceId: string;
  createdAt: string; // ISO 8601
  lat: number;
  lng: number;
  tipo: TipoEmergencia;
  heridos: number;
  personasAtrapadas: boolean;
  descripcion?: string;
}

export interface ReporteLocal extends ReporteItem {
  estadoLocal: EstadoReporteLocal;
  errorMensaje?: string;
  collectorId?: string | null;
  sincronizadoEn?: string;
}

export interface SyncPayload {
  collectorId?: string | null;
  reportes: ReporteItem[];
}

export interface SyncResponse {
  insertados: number;
  duplicados: number;
  invalidos: Array<{ id: string; error: string }>;
  triaje: {
    incidentes: number;
    nuevos: number;
    actualizados: number;
    eliminados: number;
    reportesSinIncidente: number;
  } | null;
}

export interface ResumenIncidentes {
  reportes: number;
  incidentes: number;
  porNivel: {
    CRITICA: number;
    ALTA: number;
    MEDIA: number;
    BAJA: number;
  };
  porEstado: {
    NUEVO: number;
    ASIGNADO: number;
    ATENDIDO: number;
  };
}

export interface HealthResponse {
  api: string;
  db: string;
  postgis: string;
}

export type TabActiva = 'nuevo' | 'cola' | 'mula' | 'coe';

export interface FeedbackData {
  tipo: 'exito' | 'offline' | 'error';
  texto: string;
  reporteId?: string;
}
