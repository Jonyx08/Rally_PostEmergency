import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReporteService } from './core/services/reporte.service';
import { FeedbackData, TabActiva } from './core/models/reporte.model';
import { HeaderComponent } from './shared/components/header/header.component';
import { FeedbackBannerComponent } from './shared/components/feedback-banner/feedback-banner.component';
import { FormularioEmergenciaComponent } from './features/formulario-emergencia/formulario-emergencia.component';
import { ColaReportesComponent } from './features/cola-reportes/cola-reportes.component';
import { MulaDatosComponent } from './features/mula-datos/mula-datos.component';
import { EnlaceCoeComponent } from './features/enlace-coe/enlace-coe.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    FeedbackBannerComponent,
    FormularioEmergenciaComponent,
    ColaReportesComponent,
    MulaDatosComponent,
    EnlaceCoeComponent,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class App implements OnInit {
  protected readonly reporteService = inject(ReporteService);

  readonly tema = signal<'light' | 'dark'>(this.obtenerTemaInicial());
  readonly tabActiva = signal<TabActiva>('nuevo');
  readonly feedbackMensaje = signal<FeedbackData | null>(null);

  ngOnInit(): void {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', this.tema());
    }
  }

  private obtenerTemaInicial(): 'light' | 'dark' {
    if (typeof localStorage === 'undefined') return 'light';
    const t = localStorage.getItem('redial_tema');
    return t === 'dark' ? 'dark' : 'light';
  }

  toggleTema(): void {
    const nuevo = this.tema() === 'light' ? 'dark' : 'light';
    this.tema.set(nuevo);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('redial_tema', nuevo);
    }
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', nuevo);
    }
  }

  cambiarModo(modo: 'CIUDADANO' | 'RECOLECTOR'): void {
    this.reporteService.setModo(modo);
    if (modo === 'CIUDADANO' && (this.tabActiva() === 'mula' || this.tabActiva() === 'coe')) {
      this.tabActiva.set('nuevo');
    }
  }

  setTab(tab: TabActiva): void {
    if (this.reporteService.modo() === 'CIUDADANO' && (tab === 'mula' || tab === 'coe')) {
      this.tabActiva.set('nuevo');
      return;
    }
    this.tabActiva.set(tab);
  }

  onActionFeedback(fb: FeedbackData): void {
    this.feedbackMensaje.set(fb);
  }

  onReportSubmitted(fb: FeedbackData): void {
    this.feedbackMensaje.set(fb);
  }

  cerrarFeedback(): void {
    this.feedbackMensaje.set(null);
  }
}
