import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { HeaderComponent } from './header.component';
import { ReporteService } from '../../../core/services/reporte.service';

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

describe('HeaderComponent', () => {
  beforeEach(async () => {
    mockLocalStorage.clear();
    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
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

  it('debe instanciar el componente de cabecera', () => {
    const fixture = TestBed.createComponent(HeaderComponent);
    const comp = fixture.componentInstance;
    comp.activeTab = 'nuevo';
    comp.theme = 'light';
    fixture.detectChanges();
    expect(comp).toBeTruthy();
  });

  it('debe emitir toggleTheme al pulsar el botón de tema', () => {
    const fixture = TestBed.createComponent(HeaderComponent);
    const comp = fixture.componentInstance;
    comp.activeTab = 'nuevo';
    comp.theme = 'light';
    fixture.detectChanges();

    let themeToggled = false;
    comp.toggleTheme.subscribe(() => {
      themeToggled = true;
    });

    const btnTheme = fixture.nativeElement.querySelector('.theme-toggle-btn') as HTMLButtonElement;
    btnTheme?.click();

    expect(themeToggled).toBe(true);
  });

  it('debe bloquear navegación a tabs técnicas si el usuario es ciudadano', () => {
    const fixture = TestBed.createComponent(HeaderComponent);
    const comp = fixture.componentInstance;
    const servicio = TestBed.inject(ReporteService);
    servicio.setModo('CIUDADANO');

    let tabEmitida: string | null = null;
    comp.tabChange.subscribe((t) => {
      tabEmitida = t;
    });

    comp.selectTab('mula');
    expect(tabEmitida).toBe('nuevo');

    comp.selectTab('coe');
    expect(tabEmitida).toBe('nuevo');

    comp.selectTab('cola');
    expect(tabEmitida).toBe('cola');
  });
});
