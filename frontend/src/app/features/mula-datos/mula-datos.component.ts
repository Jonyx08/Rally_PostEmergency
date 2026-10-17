import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReporteService } from '../../core/services/reporte.service';
import { FeedbackData } from '../../core/models/reporte.model';

@Component({
  selector: 'app-mula-datos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mula-datos.component.html',
  styleUrl: './mula-datos.component.css',
})
export class MulaDatosComponent {
  protected readonly reporteService = inject(ReporteService);

  @Output() actionFeedback = new EventEmitter<FeedbackData>();

  readonly collectorIdInput = signal<string>(this.reporteService.collectorId());

  guardarId(): void {
    this.reporteService.setCollectorId(this.collectorIdInput());
    this.actionFeedback.emit({
      tipo: 'exito',
      texto: `Identificador de unidad recolectora actualizado a: ${this.collectorIdInput()}`,
    });
  }

  generarMuestraSimulada(): void {
    const cant = this.reporteService.generarLoteSimuladoParaDemo();
    this.actionFeedback.emit({
      tipo: 'offline',
      texto: `Se cargaron ${cant} reportes simulados en la memoria local de la unidad para prueba de campo.`,
    });
  }

  async sincronizarManual(): Promise<void> {
    try {
      const res = await this.reporteService.sincronizarPendientes();
      if (res) {
        this.actionFeedback.emit({
          tipo: 'exito',
          texto: `Descarga completada: ${res.insertados} insertados, ${res.duplicados} prevenidos por idempotencia.`,
        });
      }
    } catch (err: any) {
      this.actionFeedback.emit({
        tipo: 'error',
        texto: `Error en la descarga al COE: ${err.message || 'Sin conexión'}`,
      });
    }
  }
}
