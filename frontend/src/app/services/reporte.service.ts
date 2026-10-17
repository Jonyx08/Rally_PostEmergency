import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout, catchError, of } from 'rxjs';
import {
  HealthResponse,
  ReporteItem,
  ReporteLocal,
  ResumenIncidentes,
  SyncPayload,
  SyncResponse,
  TipoEmergencia,
} from '../models/reporte.model';

const STORAGE_KEY_REPORTES = 'redial_reportes_offline_v1';
const STORAGE_KEY_DEVICE = 'redial_device_id';
const STORAGE_KEY_API_URL = 'redial_api_url';
const STORAGE_KEY_COLLECTOR = 'redial_collector_id';
const STORAGE_KEY_MODO = 'redial_app_modo';

// Backend desplegado en Railway (se usa cuando la PWA no corre en localhost)
export const API_URL_PRODUCCION = 'https://backend-production-0e878.up.railway.app/api';

// Coordenadas de referencia para pruebas en San Miguel, El Salvador
export const PRESETS_SAN_MIGUEL = [
  {
    nombre: 'Centro de San Miguel (Catedral)',
    lat: 13.4833,
    lng: -88.1833,
    descripcion: 'Edificación agrietada, caída de marquesina',
    tipo: 'DERRUMBE' as TipoEmergencia,
  },
  {
    nombre: 'Laderas Volcán Chaparrastique (Zona Roja)',
    lat: 13.468,
    lng: -88.209,
    descripcion: 'Alud de lodo sobre calle vecinal, varias familias aisladas',
    tipo: 'DERRUMBE' as TipoEmergencia,
  },
  {
    nombre: 'Colonia Milagro de la Paz (Río Grande)',
    lat: 13.475,
    lng: -88.172,
    descripcion: 'Desbordamiento del río, agua a 1.2m dentro de viviendas',
    tipo: 'INUNDACION' as TipoEmergencia,
  },
  {
    nombre: 'Barrio El Calvario',
    lat: 13.488,
    lng: -88.188,
    descripcion: 'Colapso de muro perimetral con personas atrapadas',
    tipo: 'PERSONA_ATRAPADA' as TipoEmergencia,
  },
  {
    nombre: 'Hospital Regional San Juan de Dios',
    lat: 13.4795,
    lng: -88.179,
    descripcion: 'Urgencia médica por lesionados múltiples tras réplica',
    tipo: 'HERIDOS' as TipoEmergencia,
  },
];

@Injectable({
  providedIn: 'root',
})
export class ReporteService {
  private readonly http = inject(HttpClient);

  // Identificador único persistente de este dispositivo
  readonly deviceId = this.obtenerOGenerarDeviceId();

  // URL del backend (configurable para demos en celular dentro de la misma red Wi-Fi)
  readonly apiUrl = signal<string>(this.obtenerApiUrlInicial());

  // Modo de operación: CIUDADANO (Zona Cero) o RECOLECTOR (Mula de Datos en Patrulla/Ambulancia)
  readonly modo = signal<'CIUDADANO' | 'RECOLECTOR'>(this.obtenerModoInicial());

  // Identificador de la patrulla o vehículo cuando opera en modo recolector
  readonly collectorId = signal<string>(this.obtenerCollectorIdInicial());

  // Estado de conectividad de red
  readonly isOnline = signal<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);
  readonly isBackendReachable = signal<boolean>(false);
  readonly sincronizando = signal<boolean>(false);
  readonly ultimaSincronizacion = signal<Date | null>(null);
  readonly ultimoResultadoSync = signal<SyncResponse | null>(null);

  // Lista reactiva de reportes locales
  readonly reportes = signal<ReporteLocal[]>(this.cargarReportesDesdeStorage());

  // Contadores computados
  readonly pendientes = computed(() => this.reportes().filter((r) => r.estadoLocal === 'PENDIENTE'));
  readonly sincronizados = computed(() => this.reportes().filter((r) => r.estadoLocal === 'SINCRONIZADO'));
  readonly conError = computed(() => this.reportes().filter((r) => r.estadoLocal === 'ERROR'));
  readonly totalReportes = computed(() => this.reportes().length);

  constructor() {
    this.iniciarMonitoreoConectividad();
    void this.verificarSaludBackend();
  }

  private obtenerOGenerarDeviceId(): string {
    if (typeof localStorage === 'undefined') return 'tel-fallback';
    let id = localStorage.getItem(STORAGE_KEY_DEVICE);
    if (!id) {
      const random = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).substring(2, 10);
      id = `tel-${random}`;
      localStorage.setItem(STORAGE_KEY_DEVICE, id);
    }
    return id;
  }

  private obtenerApiUrlInicial(): string {
    // En desarrollo (localhost) se usa el backend local; desplegada, el de Railway.
    // Siempre se puede cambiar desde la pantalla de configuración de red.
    const local = typeof location === 'undefined' || ['localhost', '127.0.0.1'].includes(location.hostname);
    const porDefecto = local ? 'http://localhost:3000/api' : API_URL_PRODUCCION;
    if (typeof localStorage === 'undefined') return porDefecto;
    return localStorage.getItem(STORAGE_KEY_API_URL) || porDefecto;
  }

  private obtenerModoInicial(): 'CIUDADANO' | 'RECOLECTOR' {
    if (typeof localStorage === 'undefined') return 'CIUDADANO';
    const m = localStorage.getItem(STORAGE_KEY_MODO);
    return m === 'RECOLECTOR' ? 'RECOLECTOR' : 'CIUDADANO';
  }

  private obtenerCollectorIdInicial(): string {
    if (typeof localStorage === 'undefined') return 'patrulla-01';
    return localStorage.getItem(STORAGE_KEY_COLLECTOR) || 'patrulla-01';
  }

  private cargarReportesDesdeStorage(): ReporteLocal[] {
    if (typeof localStorage === 'undefined') return [];
    try {
      const data = localStorage.getItem(STORAGE_KEY_REPORTES);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('Error al leer reportes de localStorage', e);
      return [];
    }
  }

  private persistirReportes(lista: ReporteLocal[]): void {
    this.reportes.set(lista);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY_REPORTES, JSON.stringify(lista));
      } catch (e) {
        console.error('Error al guardar reportes en localStorage', e);
      }
    }
  }

  setModo(modo: 'CIUDADANO' | 'RECOLECTOR'): void {
    this.modo.set(modo);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_MODO, modo);
    }
  }

  setCollectorId(id: string): void {
    const limpio = id.trim() || 'patrulla-01';
    this.collectorId.set(limpio);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_COLLECTOR, limpio);
    }
  }

  setApiUrl(url: string): void {
    const limpia = url.trim().replace(/\/+$/, '');
    this.apiUrl.set(limpia);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_API_URL, limpia);
    }
    void this.verificarSaludBackend();
  }

  private iniciarMonitoreoConectividad(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      this.isOnline.set(true);
      void this.verificarSaludBackend().then((conectado) => {
        if (conectado && this.pendientes().length > 0) {
          void this.sincronizarPendientes();
        }
      });
    });

    window.addEventListener('offline', () => {
      this.isOnline.set(false);
      this.isBackendReachable.set(false);
    });

    // Sondeo periódico liviano de salud de API cada 15 segundos
    setInterval(() => {
      if (this.isOnline()) {
        void this.verificarSaludBackend();
      }
    }, 15000);
  }

  async verificarSaludBackend(): Promise<boolean> {
    try {
      const res = await firstValueFrom(
        this.http.get<HealthResponse>(`${this.apiUrl()}/health`).pipe(
          timeout(3500),
          catchError(() => of(null))
        )
      );

      const ok = res !== null && res.api === 'ok';
      this.isBackendReachable.set(ok);
      return ok;
    } catch {
      this.isBackendReachable.set(false);
      return false;
    }
  }

  /**
   * Registra un nuevo reporte en la memoria local (offline-first).
   * Genera UUID v4 en el dispositivo (clave de idempotencia para la API).
   * Si hay conexión disponible con el COE, intenta el disparo inmediato.
   */
  async registrarReporte(datos: {
    lat: number;
    lng: number;
    tipo: TipoEmergencia;
    heridos: number;
    personasAtrapadas: boolean;
    descripcion?: string;
  }): Promise<{ reporte: ReporteLocal; transmitidoInmediato: boolean }> {
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : this.generarUUIDPolyfill();

    const nuevo: ReporteLocal = {
      id,
      deviceId: this.deviceId,
      createdAt: new Date().toISOString(),
      lat: Number(datos.lat),
      lng: Number(datos.lng),
      tipo: datos.tipo,
      heridos: Math.max(0, Math.floor(Number(datos.heridos) || 0)),
      personasAtrapadas: Boolean(datos.personasAtrapadas),
      descripcion: (datos.descripcion || '').slice(0, 280),
      estadoLocal: 'PENDIENTE',
      collectorId: this.modo() === 'RECOLECTOR' ? this.collectorId() : null,
    };

    // Almacenamiento local inmediato (Garantía de persistencia en Zona Cero)
    const actualizados = [nuevo, ...this.reportes()];
    this.persistirReportes(actualizados);

    // Si hay internet y enlace al COE, intentamos sincronizar de inmediato
    let transmitidoInmediato = false;
    if (this.isOnline()) {
      try {
        const syncRes = await this.sincronizarPendientes();
        if (syncRes && (syncRes.insertados > 0 || syncRes.duplicados > 0)) {
          transmitidoInmediato = true;
        }
      } catch (err) {
        console.warn('Registro local exitoso, sincronización inmediata pendiente:', err);
      }
    }

    return { reporte: nuevo, transmitidoInmediato };
  }

  /**
   * Sincronización en lote hacia POST /api/reportes/sync.
   * Maneja idempotencia estricta:
   * - Tanto insertados como duplicados pasan a estadoLocal: 'SINCRONIZADO'
   * - Los devueltos en invalidos pasan a estadoLocal: 'ERROR'
   */
  async sincronizarPendientes(): Promise<SyncResponse | null> {
    const cola = this.pendientes();
    if (cola.length === 0) return null;

    this.sincronizando.set(true);

    const payload: SyncPayload = {
      collectorId: this.modo() === 'RECOLECTOR' ? this.collectorId() : null,
      reportes: cola.map((r) => ({
        id: r.id,
        deviceId: r.deviceId,
        createdAt: r.createdAt,
        lat: r.lat,
        lng: r.lng,
        tipo: r.tipo,
        heridos: r.heridos,
        personasAtrapadas: r.personasAtrapadas,
        descripcion: r.descripcion,
      })),
    };

    try {
      const res = await firstValueFrom(
        this.http.post<SyncResponse>(`${this.apiUrl()}/reportes/sync`, payload).pipe(
          timeout(10000)
        )
      );

      this.isBackendReachable.set(true);
      this.ultimaSincronizacion.set(new Date());
      this.ultimoResultadoSync.set(res);

      const invalidosMap = new Map<string, string>();
      for (const inv of res.invalidos || []) {
        invalidosMap.set(inv.id, inv.error);
      }

      const fechaSync = new Date().toISOString();
      const idsEnviados = new Set(cola.map((c) => c.id));

      const listaActualizada = this.reportes().map((item) => {
        if (!idsEnviados.has(item.id)) {
          return item;
        }

        if (invalidosMap.has(item.id)) {
          return {
            ...item,
            estadoLocal: 'ERROR' as const,
            errorMensaje: invalidosMap.get(item.id),
          };
        }

        // Si fue insertado o ya existía como duplicado, el COE ya lo tiene
        return {
          ...item,
          estadoLocal: 'SINCRONIZADO' as const,
          errorMensaje: undefined,
          sincronizadoEn: fechaSync,
        };
      });

      this.persistirReportes(listaActualizada);
      return res;
    } catch (error: any) {
      console.error('Error al sincronizar lote de reportes:', error);
      this.isBackendReachable.set(false);
      throw error;
    } finally {
      this.sincronizando.set(false);
    }
  }

  async consultarResumenCOE(): Promise<ResumenIncidentes | null> {
    try {
      return await firstValueFrom(
        this.http.get<ResumenIncidentes>(`${this.apiUrl()}/incidentes/resumen`).pipe(
          timeout(4000),
          catchError(() => of(null))
        )
      );
    } catch {
      return null;
    }
  }

  /**
   * Generador de datos simulados para la demostración del Rally.
   * Crea entre 3 y 5 reportes en lugares conocidos de San Miguel.
   */
  generarLoteSimuladoParaDemo(): number {
    const muestras = PRESETS_SAN_MIGUEL;
    const nuevos: ReporteLocal[] = [];

    muestras.forEach((m, idx) => {
      // Pequeña variación de metros para simular vecinos cercanos
      const deltaLat = (Math.random() - 0.5) * 0.0008;
      const deltaLng = (Math.random() - 0.5) * 0.0008;
      const heridos = idx % 2 === 0 ? Math.floor(Math.random() * 4) + 1 : 0;
      const atrapados = idx === 3 || idx === 1;

      nuevos.push({
        id: this.generarUUIDPolyfill(),
        deviceId: `sim-${this.deviceId.slice(-4)}-${idx + 1}`,
        createdAt: new Date(Date.now() - idx * 180000).toISOString(),
        lat: Number((m.lat + deltaLat).toFixed(6)),
        lng: Number((m.lng + deltaLng).toFixed(6)),
        tipo: m.tipo,
        heridos,
        personasAtrapadas: atrapados,
        descripcion: `${m.descripcion} [Reporte simulado #${idx + 1}]`,
        estadoLocal: 'PENDIENTE',
        collectorId: this.modo() === 'RECOLECTOR' ? this.collectorId() : null,
      });
    });

    const combinados = [...nuevos, ...this.reportes()];
    this.persistirReportes(combinados);
    return nuevos.length;
  }

  limpiarTodosLosReportes(): void {
    this.persistirReportes([]);
    this.ultimoResultadoSync.set(null);
  }

  reintentarReporte(id: string): void {
    const lista = this.reportes().map((r) => (r.id === id ? { ...r, estadoLocal: 'PENDIENTE' as const, errorMensaje: undefined } : r));
    this.persistirReportes(lista);
    if (this.isOnline()) {
      void this.sincronizarPendientes();
    }
  }

  eliminarReporte(id: string): void {
    const lista = this.reportes().filter((r) => r.id !== id);
    this.persistirReportes(lista);
  }

  private generarUUIDPolyfill(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
