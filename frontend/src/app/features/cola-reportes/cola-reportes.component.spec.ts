import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ColaReportesComponent } from './cola-reportes.component';
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

describe('ColaReportesComponent', () => {
  beforeEach(async () => {
    mockLocalStorage.clear();
    await TestBed.configureTestingModule({
      imports: [ColaReportesComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        ReporteService,
      ],
    }).compileComponents();
  });

  afterEach(() => {
    mockLocalStorage.clear();
  });

  it('debe instanciarse correctamente y mostrar estado vacío inicial', () => {
    const fixture = TestBed.createComponent(ColaReportesComponent);
    const comp = fixture.componentInstance;
    expect(comp).toBeTruthy();
  });

  it('debe generar muestra simulada y emitir feedback', () => {
    const fixture = TestBed.createComponent(ColaReportesComponent);
    const comp = fixture.componentInstance;
    const servicio = TestBed.inject(ReporteService);

    let feedback: any = null;
    comp.actionFeedback.subscribe((f) => {
      feedback = f;
    });

    comp.generarMuestraSimulada();
    expect(servicio.reportes().length).toBeGreaterThan(0);
    expect(feedback).toBeTruthy();
    expect(feedback.tipo).toBe('offline');
  });

  it('debe vaciar la cola de reportes y emitir feedback', () => {
    const fixture = TestBed.createComponent(ColaReportesComponent);
    const comp = fixture.componentInstance;
    const servicio = TestBed.inject(ReporteService);

    comp.generarMuestraSimulada();
    expect(servicio.reportes().length).toBeGreaterThan(0);

    let feedback: any = null;
    comp.actionFeedback.subscribe((f) => {
      feedback = f;
    });

    comp.limpiarCola();
    expect(servicio.reportes().length).toBe(0);
    expect(feedback.texto).toContain('vaciado el búfer');
  });
});
