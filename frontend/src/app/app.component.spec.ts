import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { App } from './app.component';
import { ReporteService } from './core/services/reporte.service';

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

describe('App', () => {
  beforeEach(async () => {
    mockLocalStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
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

  it('debe instanciar el componente principal', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('debe mostrar el título de REDIAL 09', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand-title')?.textContent).toContain('REDIAL 09');
  });

  it('debe iniciar en modo ciudadano con pestaña nuevo', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app.tabActiva()).toBe('nuevo');
  });

  it('debe restringir opciones técnicas al ciudadano y habilitarlas solo en modo patrulla', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;

    // En modo ciudadano: 'cola' ('Mis Reportes') es accesible
    app.setTab('cola');
    expect(app.tabActiva()).toBe('cola');

    // Intentar acceder a mula o coe como ciudadano debe ser bloqueado y redirigir a nuevo
    app.setTab('mula');
    expect(app.tabActiva()).toBe('nuevo');

    // Cambiar a modo Patrulla/Mula habilita todas las opciones
    app.cambiarModo('RECOLECTOR');
    app.setTab('mula');
    expect(app.tabActiva()).toBe('mula');

    app.setTab('coe');
    expect(app.tabActiva()).toBe('coe');

    // Si vuelve a modo ciudadano estando en coe, se redirige de inmediato a nuevo
    app.cambiarModo('CIUDADANO');
    expect(app.tabActiva()).toBe('nuevo');
  });

  it('debe alternar tema claro / oscuro', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app.tema()).toBe('light');

    app.toggleTema();
    expect(app.tema()).toBe('dark');

    app.toggleTema();
    expect(app.tema()).toBe('light');
  });

  it('debe actualizar el mensaje de feedback y cerrarlo correctamente', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app.feedbackMensaje()).toBeNull();

    app.onReportSubmitted({
      tipo: 'exito',
      texto: 'Reporte transmitido al COE',
      reporteId: 'test-uuid-1234',
    });
    expect(app.feedbackMensaje()?.texto).toContain('Reporte transmitido al COE');

    app.cerrarFeedback();
    expect(app.feedbackMensaje()).toBeNull();
  });
});
