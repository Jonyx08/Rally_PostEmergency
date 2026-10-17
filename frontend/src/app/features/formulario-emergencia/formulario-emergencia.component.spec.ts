import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { FormularioEmergenciaComponent } from './formulario-emergencia.component';
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

describe('FormularioEmergenciaComponent', () => {
  beforeEach(async () => {
    mockLocalStorage.clear();
    await TestBed.configureTestingModule({
      imports: [FormularioEmergenciaComponent],
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

  it('debe instanciar el componente de formulario de emergencia', () => {
    const fixture = TestBed.createComponent(FormularioEmergenciaComponent);
    const comp = fixture.componentInstance;
    expect(comp).toBeTruthy();
    expect(comp.tipoSeleccionado()).toBe('DERRUMBE');
    expect(comp.heridos()).toBe(0);
    expect(comp.personasAtrapadas()).toBe(false);
  });

  it('debe ajustar la cantidad de personas heridas con límites válidos', () => {
    const fixture = TestBed.createComponent(FormularioEmergenciaComponent);
    const comp = fixture.componentInstance;

    comp.ajustarHeridos(1);
    expect(comp.heridos()).toBe(1);

    comp.ajustarHeridos(2);
    expect(comp.heridos()).toBe(3);

    comp.ajustarHeridos(-5);
    expect(comp.heridos()).toBe(0); // No debe ser negativo
  });

  it('debe registrar un reporte en la cola local cuando el dispositivo está offline', async () => {
    const fixture = TestBed.createComponent(FormularioEmergenciaComponent);
    const comp = fixture.componentInstance;
    const servicio = TestBed.inject(ReporteService);

    // Simular offline
    (servicio.isOnline as any).set(false);

    let feedbackEmitido: any = null;
    comp.reportSubmitted.subscribe((fb) => {
      feedbackEmitido = fb;
    });

    comp.seleccionarTipo('PERSONA_ATRAPADA');
    comp.ajustarHeridos(2);
    comp.personasAtrapadas.set(true);
    comp.descripcion.set('Dos personas bajo loza colapsada');

    await comp.enviarReporte();

    expect(servicio.reportes().length).toBe(1);
    expect(servicio.pendientes().length).toBe(1);
    expect(servicio.reportes()[0].tipo).toBe('PERSONA_ATRAPADA');
    expect(servicio.reportes()[0].heridos).toBe(2);
    expect(servicio.reportes()[0].personasAtrapadas).toBe(true);
    expect(feedbackEmitido).toBeTruthy();
    expect(feedbackEmitido.tipo).toBe('offline');
  });
});
