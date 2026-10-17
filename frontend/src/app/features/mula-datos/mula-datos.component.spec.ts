import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { MulaDatosComponent } from './mula-datos.component';
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

describe('MulaDatosComponent', () => {
  beforeEach(async () => {
    mockLocalStorage.clear();
    await TestBed.configureTestingModule({
      imports: [MulaDatosComponent],
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

  it('debe instanciar el componente de Mula de Datos', () => {
    const fixture = TestBed.createComponent(MulaDatosComponent);
    const comp = fixture.componentInstance;
    expect(comp).toBeTruthy();
  });

  it('debe permitir actualizar el identificador del recolector y emitir feedback', () => {
    const fixture = TestBed.createComponent(MulaDatosComponent);
    const comp = fixture.componentInstance;
    const servicio = TestBed.inject(ReporteService);

    let feedback: any = null;
    comp.actionFeedback.subscribe((f) => {
      feedback = f;
    });

    comp.collectorIdInput.set('patrulla-univo-09');
    comp.guardarId();

    expect(servicio.collectorId()).toBe('patrulla-univo-09');
    expect(feedback.tipo).toBe('exito');
    expect(feedback.texto).toContain('patrulla-univo-09');
  });
});
