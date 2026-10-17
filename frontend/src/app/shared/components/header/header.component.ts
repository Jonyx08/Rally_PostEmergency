import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReporteService } from '../../../core/services/reporte.service';
import { TabActiva } from '../../../core/models/reporte.model';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class HeaderComponent {
  protected readonly reporteService = inject(ReporteService);

  @Input({ required: true }) activeTab: TabActiva = 'nuevo';
  @Input({ required: true }) theme: 'light' | 'dark' = 'light';

  @Output() tabChange = new EventEmitter<TabActiva>();
  @Output() toggleTheme = new EventEmitter<void>();

  selectTab(tab: TabActiva): void {
    if (this.reporteService.modo() === 'CIUDADANO' && (tab === 'mula' || tab === 'coe')) {
      this.tabChange.emit('nuevo');
      return;
    }
    this.tabChange.emit(tab);
  }

  changeRole(modo: 'CIUDADANO' | 'RECOLECTOR'): void {
    this.reporteService.setModo(modo);
    if (modo === 'CIUDADANO' && (this.activeTab === 'mula' || this.activeTab === 'coe')) {
      this.tabChange.emit('nuevo');
    }
  }

  async triggerManualSync(): Promise<void> {
    try {
      await this.reporteService.sincronizarPendientes();
    } catch (err) {
      console.error('Error al sincronizar:', err);
    }
  }
}
