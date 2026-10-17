import { Component, EventEmitter, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PRESETS_SAN_MIGUEL, ReporteService } from '../../core/services/reporte.service';
import { FeedbackData, TipoEmergencia } from '../../core/models/reporte.model';

export interface TipoEmergenciaItem {
  tipo: TipoEmergencia;
  label: string;
  sublabel: string;
  color: string;
  iconPath: string;
}

@Component({
  selector: 'app-formulario-emergencia',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './formulario-emergencia.component.html',
  styleUrl: './formulario-emergencia.component.css',
})
export class FormularioEmergenciaComponent {
  protected readonly reporteService = inject(ReporteService);

  @Output() reportSubmitted = new EventEmitter<FeedbackData>();

  readonly tipoSeleccionado = signal<TipoEmergencia>('DERRUMBE');
  readonly latitud = signal<number>(13.4833);
  readonly longitud = signal<number>(-88.1833);
  readonly heridos = signal<number>(0);
  readonly personasAtrapadas = signal<boolean>(false);
  readonly descripcion = signal<string>('');
  readonly gpsEstado = signal<string>('');
  readonly enviando = signal<boolean>(false);

  readonly presets = PRESETS_SAN_MIGUEL;

  readonly tiposEmergencia: TipoEmergenciaItem[] = [
    {
      tipo: 'DERRUMBE',
      label: 'Derrumbe / Alud',
      sublabel: 'Deslave o colapso estructural',
      color: '#c2410c',
      iconPath: 'm8 3 4 8 5-5 5 15H2L8 3z M4.14 15h15.72',
    },
    {
      tipo: 'PERSONA_ATRAPADA',
      label: 'Personas Atrapadas',
      sublabel: 'Bajo escombros o confinadas',
      color: '#dc2626',
      iconPath: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z M12 8v4 M12 16h.01',
    },
    {
      tipo: 'HERIDOS',
      label: 'Heridos Múltiples',
      sublabel: 'Atención prehospitalaria urgente',
      color: '#be123c',
      iconPath: 'M11 2a2 2 0 0 0-2 2v5H4a2 2 0 0 0-2 2v2c0 1.1.9 2 2 2h5v5c0 1.1.9 2 2 2h2a2 2 0 0 0 2-2v-5h5a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-5V4a2 2 0 0 0-2-2h-2z',
    },
    {
      tipo: 'INUNDACION',
      label: 'Inundación Severa',
      sublabel: 'Crecida de río o anegamiento',
      color: '#0369a1',
      iconPath: 'M2 12c1.5-1.5 3-2 4.5-2s3 .5 4.5 2 3 2 4.5 2 3-.5 4.5-2 M2 17c1.5-1.5 3-2 4.5-2s3 .5 4.5 2 3 2 4.5 2 3-.5 4.5-2 M2 7c1.5-1.5 3-2 4.5-2s3 .5 4.5 2 3 2 4.5 2 3-.5 4.5-2',
    },
    {
      tipo: 'INCENDIO',
      label: 'Incendio Activo',
      sublabel: 'Fuego forestal o urbano',
      color: '#ea580c',
      iconPath: 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z',
    },
    {
      tipo: 'OTRO',
      label: 'Otro Incidente',
      sublabel: 'Peligro general no clasificado',
      color: '#475569',
      iconPath: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z M12 9v4 M12 17h.01',
    },
  ];

  seleccionarTipo(tipo: TipoEmergencia): void {
    this.tipoSeleccionado.set(tipo);
  }

  aplicarPreset(event: Event): void {
    const idx = Number((event.target as HTMLSelectElement).value);
    if (idx >= 0 && idx < this.presets.length) {
      const preset = this.presets[idx];
      this.latitud.set(preset.lat);
      this.longitud.set(preset.lng);
      this.tipoSeleccionado.set(preset.tipo);
      this.descripcion.set(preset.descripcion);
      if (preset.tipo === 'PERSONA_ATRAPADA') {
        this.personasAtrapadas.set(true);
        this.heridos.set(2);
      } else if (preset.tipo === 'HERIDOS') {
        this.heridos.set(3);
      }
      this.gpsEstado.set(`Ubicación de referencia: ${preset.nombre}`);
    }
  }

  obtenerUbicacionGPS(): void {
    if (!navigator.geolocation) {
      this.gpsEstado.set('Geolocalización no soportada en este dispositivo');
      return;
    }

    this.gpsEstado.set('Obteniendo coordenadas satelitales GPS...');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        const precision = Math.round(pos.coords.accuracy || 0);

        this.latitud.set(lat);
        this.longitud.set(lng);
        this.gpsEstado.set(`Fijado: ${lat}, ${lng} (precisión ±${precision} m)`);
      },
      (err) => {
        console.warn('Error al obtener GPS:', err);
        this.gpsEstado.set(`Sin señal GPS (${err.message}). Ingrese coordenadas manualmente.`);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      }
    );
  }

  ajustarHeridos(delta: number): void {
    const actual = this.heridos();
    const nuevo = Math.max(0, actual + delta);
    this.heridos.set(nuevo);
  }

  async enviarReporte(): Promise<void> {
    if (this.enviando()) return;
    this.enviando.set(true);

    try {
      const res = await this.reporteService.registrarReporte({
        tipo: this.tipoSeleccionado(),
        lat: this.latitud(),
        lng: this.longitud(),
        heridos: this.heridos(),
        personasAtrapadas: this.personasAtrapadas(),
        descripcion: this.descripcion(),
      });

      const esCiudadano = this.reporteService.modo() === 'CIUDADANO';

      this.reportSubmitted.emit({
        tipo: res.transmitidoInmediato ? 'exito' : 'offline',
        texto: res.transmitidoInmediato
          ? esCiudadano
            ? '¡Reporte transmitido al 911 / COE! Los equipos de auxilio han recibido tu alerta.'
            : 'Reporte transmitido en vivo al COE central. Incidente procesado para triaje.'
          : esCiudadano
          ? 'Tu reporte de auxilio está a salvo en la memoria de tu teléfono. Al pasar una patrulla o ambulancia cercana, se transferirá automáticamente.'
          : 'Reporte almacenado en memoria local (Zona Cero). Pendiente de descarga al pasar unidad recolectora.',
        reporteId: res.reporte.id,
      });

      this.descripcion.set('');
      this.heridos.set(0);
      this.personasAtrapadas.set(false);
    } catch (err: any) {
      this.reportSubmitted.emit({
        tipo: 'error',
        texto: `Error al procesar el reporte: ${err.message || 'Error de comunicación'}`,
      });
    } finally {
      this.enviando.set(false);
    }
  }
}
