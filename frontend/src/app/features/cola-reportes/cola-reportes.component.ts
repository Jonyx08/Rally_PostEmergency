import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReporteService } from '../../core/services/reporte.service';
import { FeedbackData } from '../../core/models/reporte.model';

@Component({
  selector: 'app-cola-reportes',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cola-reportes.component.html',
  styleUrl: './cola-reportes.component.css',
})
export class ColaReportesComponent {
  protected readonly reporteService = inject(ReporteService);

  @Output() actionFeedback = new EventEmitter<FeedbackData>();

  async sincronizarLote(): Promise<void> {
    try {
      await this.reporteService.sincronizarPendientes();
    } catch (err: any) {
      this.actionFeedback.emit({
        tipo: 'error',
        texto: `Error al sincronizar con el COE: ${err.message || 'Sin respuesta'}`,
      });
    }
  }

  generarMuestraSimulada(): void {
    const cant = this.reporteService.generarLoteSimuladoParaDemo();
    this.actionFeedback.emit({
      tipo: 'offline',
      texto: `Se cargaron ${cant} reportes simulados en el búfer de la unidad para prueba de campo.`,
    });
  }

  limpiarCola(): void {
    this.reporteService.limpiarTodosLosReportes();
    this.actionFeedback.emit({
      tipo: 'offline',
      texto: 'Se ha vaciado el búfer de reportes locales.',
    });
  }

  reintentar(id: string): void {
    this.reporteService.reintentarReporte(id);
  }

  eliminar(id: string): void {
    this.reporteService.eliminarReporte(id);
  }
}
