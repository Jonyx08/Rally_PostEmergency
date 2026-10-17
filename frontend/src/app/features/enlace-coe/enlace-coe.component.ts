import { Component, EventEmitter, OnInit, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReporteService } from '../../core/services/reporte.service';
import { FeedbackData, ResumenIncidentes } from '../../core/models/reporte.model';

@Component({
  selector: 'app-enlace-coe',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './enlace-coe.component.html',
  styleUrl: './enlace-coe.component.css',
})
export class EnlaceCoeComponent implements OnInit {
  protected readonly reporteService = inject(ReporteService);

  @Output() actionFeedback = new EventEmitter<FeedbackData>();

  /** Raíz del backend (sin /api), para los enlaces dinámicos al tablero del COE. */
  readonly urlBackendBase = computed(() => this.reporteService.apiUrl().replace(/\/api\/?$/, ''));
  readonly apiUrlInput = signal<string>(this.reporteService.apiUrl());
  readonly resumenCoe = signal<ResumenIncidentes | null>(null);
  readonly cargandoResumenCoe = signal<boolean>(false);

  ngOnInit(): void {
    void this.actualizarResumenCoe();
  }

  async actualizarResumenCoe(): Promise<void> {
    this.cargandoResumenCoe.set(true);
    try {
      const data = await this.reporteService.consultarResumenCOE();
      this.resumenCoe.set(data);
    } catch {
      this.resumenCoe.set(null);
    } finally {
      this.cargandoResumenCoe.set(false);
    }
  }

  async guardarConfiguracionRed(): Promise<void> {
    this.reporteService.setApiUrl(this.apiUrlInput());
    await this.actualizarResumenCoe();
    this.actionFeedback.emit({
      tipo: 'exito',
      texto: 'Configuración de enlace COE actualizada.',
    });
  }
}
