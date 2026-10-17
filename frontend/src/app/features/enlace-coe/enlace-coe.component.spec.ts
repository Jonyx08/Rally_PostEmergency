import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EnlaceCoeComponent } from './enlace-coe.component';
import { ReporteService } from '../../core/services/reporte.service';

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

describe('EnlaceCoeComponent', () => {
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    mockLocalStorage.clear();
    await TestBed.configureTestingModule({
      imports: [EnlaceCoeComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ReporteService,
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    const healthReqs = httpMock.match((r) => r.url.includes('/api/health'));
    healthReqs.filter((r) => !r.cancelled).forEach((r) => r.flush({ status: 'ok' }));

    const coeReqs = httpMock.match((r) => r.url.includes('/api/incidentes/resumen'));
    coeReqs.filter((r) => !r.cancelled).forEach((r) =>
      r.flush({ reportes: 0, incidentes: 0, porNivel: { CRITICA: 0, ALTA: 0, MEDIA: 0, BAJA: 0 } })
    );

    mockLocalStorage.clear();
  });

  it('debe instanciar el componente de enlace COE', () => {
    const fixture = TestBed.createComponent(EnlaceCoeComponent);
    const comp = fixture.componentInstance;
    expect(comp).toBeTruthy();
    expect(comp.apiUrlInput()).toContain('/api');
  });

  it('debe actualizar la URL del backend y emitir feedback', async () => {
    const fixture = TestBed.createComponent(EnlaceCoeComponent);
    const comp = fixture.componentInstance;
    const servicio = TestBed.inject(ReporteService);

    fixture.detectChanges();

    const initialReq = httpMock.expectOne((r) => r.url.includes('/api/incidentes/resumen'));
    initialReq.flush({ reportes: 0, incidentes: 0, porNivel: { CRITICA: 0, ALTA: 0, MEDIA: 0, BAJA: 0 } });

    let feedback: any = null;
    comp.actionFeedback.subscribe((f) => {
      feedback = f;
    });

    comp.apiUrlInput.set('http://192.168.1.50:3000/api');
    const promise = comp.guardarConfiguracionRed();

    const saveReq = httpMock.expectOne((r) => r.url.includes('/api/incidentes/resumen'));
    saveReq.flush({ reportes: 5, incidentes: 2, porNivel: { CRITICA: 1, ALTA: 1, MEDIA: 0, BAJA: 0 } });

    await promise;

    expect(servicio.apiUrl()).toBe('http://192.168.1.50:3000/api');
    expect(feedback.tipo).toBe('exito');
  });
});
