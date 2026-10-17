import { validarReporte } from '../src/reportes/validacion';

const valido = {
  id: '5F0C2B9E-8A3D-4C1E-9B7A-2D6F1E0A4C33',
  deviceId: ' tel-1 ',
  createdAt: '2026-10-17T06:00:00Z',
  lat: 13.48,
  lng: -88.18,
  tipo: 'DERRUMBE',
  heridos: 2,
  personasAtrapadas: true,
  descripcion: '  Casa colapsada ',
};

describe('validarReporte', () => {
  it('acepta un reporte correcto y lo normaliza', () => {
    const r = validarReporte(valido);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.reporte.id).toBe('5f0c2b9e-8a3d-4c1e-9b7a-2d6f1e0a4c33');
    expect(r.reporte.deviceId).toBe('tel-1');
    expect(r.reporte.descripcion).toBe('Casa colapsada');
    expect(r.reporte.createdAt.toISOString()).toBe('2026-10-17T06:00:00.000Z');
  });

  it('descripcion es opcional', () => {
    const { descripcion, ...sin } = valido;
    const r = validarReporte(sin);
    expect(r.ok && r.reporte.descripcion).toBeNull();
  });

  it.each([
    ['id', 'no-es-uuid', 'id debe ser un UUID'],
    ['lat', 91, 'lat fuera de rango'],
    ['lng', -181, 'lng fuera de rango'],
    ['tipo', 'TERREMOTO', 'tipo debe ser uno de'],
    ['heridos', -1, 'heridos debe ser un entero'],
    ['heridos', 1.5, 'heridos debe ser un entero'],
    ['personasAtrapadas', 'si', 'personasAtrapadas'],
    ['createdAt', 'ayer', 'createdAt'],
    ['descripcion', 'x'.repeat(281), 'descripcion supera 280'],
  ])('rechaza %s = %p', (campo, valor, mensaje) => {
    const r = validarReporte({ ...valido, [campo]: valor });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain(mensaje);
  });

  it('rechaza algo que no es un objeto', () => {
    expect(validarReporte(null).ok).toBe(false);
    expect(validarReporte([1]).ok).toBe(false);
  });
});
