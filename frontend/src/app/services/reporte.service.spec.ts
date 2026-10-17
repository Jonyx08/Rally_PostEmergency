import { TestBed } from '@angular/core/testing';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { ReporteService } from './reporte.service';
import { SyncResponse } from '../models/reporte.model';

const storageMock: Record<string, string> = {};
const mockLocalStorage = {
  getItem: (k: string) => storageMock[k] ?? null,
  setItem: (k: string, v: string) => { storageMock[k] = String(v); },
  removeItem: (k: string) => { delete storageMock[k]; },
  clear: () => {
    for (const key of Object.keys(storageMock)) {
      delete storageMock[key];
    }
  },
};

Object.defineProperty(globalThis, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
  configurable: true,
});

describe('ReporteService', () => {
  let service: ReporteService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    mockLocalStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ReporteService,
      ],
    });
    service = TestBed.inject(ReporteService);
    httpMock = TestBed.inject(HttpTestingController);

    // Drenar peticiones de verificación de salud automáticas del constructor
    const healthReqs = httpMock.match((r) => r.url.endsWith('/health'));
    healthReqs.forEach((r) => r.flush({ api: 'ok', db: 'ok', postgis: '3.4.3' }));
  });

  afterEach(() => {
    // Drenar cualquier health adicional
    const extraHealth = httpMock.match((r) => r.url.endsWith('/health'));
    extraHealth.forEach((r) => r.flush({ api: 'ok', db: 'ok', postgis: '3.4.3' }));
    httpMock.verify();
    mockLocalStorage.clear();
    TestBed.resetTestingModule();
  });

  it('debe inicializarse con un deviceId persistente', () => {
    expect(service.deviceId).toBeTruthy();
    expect(service.deviceId.startsWith('tel-')).toBe(true);
  });

  it('debe registrar un reporte offline con estado PENDIENTE y UUID v4', async () => {
    (service.isOnline as any).set(false);

    const { reporte, transmitidoInmediato } = await service.registrarReporte({
      tipo: 'INUNDACION',
      lat: 13.48,
      lng: -88.18,
      heridos: 1,
      personasAtrapadas: false,
      descripcion: 'Río crecido',
    });

    expect(transmitidoInmediato).toBe(false);
    expect(reporte.id).toMatch(/^[0-9a-f-]{36}$/i);
    expect(reporte.estadoLocal).toBe('PENDIENTE');
    expect(service.pendientes().length).toBe(1);
  });

  it('debe procesar respuesta de sync marcando insertados y duplicados como SINCRONIZADO (idempotencia)', async () => {
    (service.isOnline as any).set(false);

    await service.registrarReporte({
      tipo: 'DERRUMBE',
      lat: 13.483,
      lng: -88.183,
      heridos: 0,
      personasAtrapadas: false,
    });

    await service.registrarReporte({
      tipo: 'INCENDIO',
      lat: 13.485,
      lng: -88.185,
      heridos: 2,
      personasAtrapadas: true,
    });

    expect(service.pendientes().length).toBe(2);

    const syncPromise = service.sincronizarPendientes();

    const req = httpMock.expectOne('http://localhost:3000/api/reportes/sync');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.reportes.length).toBe(2);

    const mockResponse: SyncResponse = {
      insertados: 1,
      duplicados: 1,
      invalidos: [],
      triaje: {
        incidentes: 2,
        nuevos: 1,
        actualizados: 1,
        eliminados: 0,
        reportesSinIncidente: 0,
      },
    };

    req.flush(mockResponse);
    const resultado = await syncPromise;

    expect(resultado?.insertados).toBe(1);
    expect(resultado?.duplicados).toBe(1);
    expect(service.pendientes().length).toBe(0);
    expect(service.sincronizados().length).toBe(2);
  });

  it('debe marcar como ERROR reportes que el backend rechaza en invalidos', async () => {
    (service.isOnline as any).set(false);

    const r = await service.registrarReporte({
      tipo: 'OTRO',
      lat: 999, // Coordenada inválida
      lng: -88.18,
      heridos: 0,
      personasAtrapadas: false,
    });

    const syncPromise = service.sincronizarPendientes();
    const req = httpMock.expectOne('http://localhost:3000/api/reportes/sync');

    const mockResponse: SyncResponse = {
      insertados: 0,
      duplicados: 0,
      invalidos: [{ id: r.reporte.id, error: 'lat fuera de rango' }],
      triaje: null,
    };

    req.flush(mockResponse);
    await syncPromise;

    expect(service.pendientes().length).toBe(0);
    expect(service.conError().length).toBe(1);
    expect(service.conError()[0].errorMensaje).toBe('lat fuera de rango');
  });
});
