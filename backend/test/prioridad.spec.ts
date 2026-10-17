import { calcularPrioridad, nivelDesdePuntaje, tipoMasGrave } from '../src/triaje/prioridad';

describe('calcularPrioridad', () => {
  const base = { cantidadReportes: 1, heridosEstimados: 0, hayAtrapados: false, tipos: ['OTRO' as const], nivelZona: null };

  it('un reporte aislado sin heridos queda en prioridad BAJA', () => {
    const r = calcularPrioridad(base);
    expect(r.prioridad).toBe(5); // 2 (1 reporte) + 3 (tipo OTRO)
    expect(r.nivelPrioridad).toBe('BAJA');
  });

  it('una zona ROJA sube la prioridad frente al mismo incidente fuera de zona', () => {
    const fuera = calcularPrioridad({ ...base, tipos: ['DERRUMBE'], cantidadReportes: 5 });
    const roja = calcularPrioridad({ ...base, tipos: ['DERRUMBE'], cantidadReportes: 5, nivelZona: 'ROJO' });
    expect(roja.prioridad - fuera.prioridad).toBe(20);
    expect(roja.desglose.zonaRiesgo).toBe(20);
  });

  it('ROJO pesa más que NARANJA y NARANJA más que AMARILLO', () => {
    const p = (nivelZona: 'ROJO' | 'NARANJA' | 'AMARILLO') => calcularPrioridad({ ...base, nivelZona }).prioridad;
    expect(p('ROJO')).toBeGreaterThan(p('NARANJA'));
    expect(p('NARANJA')).toBeGreaterThan(p('AMARILLO'));
  });

  it('los factores tienen tope y el máximo posible es 100', () => {
    const r = calcularPrioridad({
      cantidadReportes: 500,
      heridosEstimados: 500,
      hayAtrapados: true,
      tipos: ['PERSONA_ATRAPADA'],
      nivelZona: 'ROJO',
    });
    expect(r.desglose).toEqual({ reportes: 20, heridos: 25, atrapados: 20, tipo: 15, zonaRiesgo: 20 });
    expect(r.prioridad).toBe(100);
    expect(r.nivelPrioridad).toBe('CRITICA');
  });

  it('el desglose suma exactamente la prioridad', () => {
    const r = calcularPrioridad({ cantidadReportes: 3, heridosEstimados: 2, hayAtrapados: true, tipos: ['INCENDIO'], nivelZona: 'NARANJA' });
    const suma = Object.values(r.desglose).reduce((a, b) => a + b, 0);
    expect(suma).toBe(r.prioridad);
  });
});

describe('tipoMasGrave', () => {
  it('elige el tipo con más peso del grupo', () => {
    expect(tipoMasGrave(['OTRO', 'INUNDACION', 'PERSONA_ATRAPADA'])).toBe('PERSONA_ATRAPADA');
    expect(tipoMasGrave([])).toBe('OTRO');
  });
});

describe('nivelDesdePuntaje', () => {
  it.each([
    [100, 'CRITICA'],
    [75, 'CRITICA'],
    [74, 'ALTA'],
    [50, 'ALTA'],
    [49, 'MEDIA'],
    [25, 'MEDIA'],
    [24, 'BAJA'],
    [0, 'BAJA'],
  ])('%i puntos → %s', (puntos, nivel) => {
    expect(nivelDesdePuntaje(puntos)).toBe(nivel);
  });
});
