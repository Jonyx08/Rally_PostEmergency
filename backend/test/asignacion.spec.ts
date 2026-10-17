import { asignarIncidentes } from '../src/triaje/asignacion';

function generador() {
  let n = 0;
  return () => `nuevo-${++n}`;
}

describe('asignarIncidentes', () => {
  it('un grupo sin incidente previo recibe un incidente nuevo', () => {
    const r = asignarIncidentes(
      [
        { reporteId: 'a', incidenteActual: null, cluster: 0 },
        { reporteId: 'b', incidenteActual: null, cluster: 0 },
      ],
      generador(),
    );
    expect(r.asignaciones.get('a')).toBe('nuevo-1');
    expect(r.asignaciones.get('b')).toBe('nuevo-1');
    expect([...r.nuevos]).toEqual(['nuevo-1']);
  });

  it('un grupo conserva el incidente que ya tenía la mayoría de sus reportes', () => {
    const r = asignarIncidentes(
      [
        { reporteId: 'a', incidenteActual: 'inc-1', cluster: 3 },
        { reporteId: 'b', incidenteActual: 'inc-1', cluster: 3 },
        { reporteId: 'c', incidenteActual: null, cluster: 3 }, // reporte recién llegado
      ],
      generador(),
    );
    expect(r.asignaciones.get('c')).toBe('inc-1');
    expect(r.nuevos.size).toBe(0);
    expect([...r.conservados]).toEqual(['inc-1']);
  });

  it('si un incidente se parte, el grupo más grande conserva el id', () => {
    const r = asignarIncidentes(
      [
        { reporteId: 'a', incidenteActual: 'inc-1', cluster: 0 },
        { reporteId: 'b', incidenteActual: 'inc-1', cluster: 1 },
        { reporteId: 'c', incidenteActual: 'inc-1', cluster: 1 },
      ],
      generador(),
    );
    expect(r.asignaciones.get('b')).toBe('inc-1');
    expect(r.asignaciones.get('c')).toBe('inc-1');
    expect(r.asignaciones.get('a')).toBe('nuevo-1');
  });

  it('los reportes marcados como ruido quedan sin incidente', () => {
    const r = asignarIncidentes([{ reporteId: 'a', incidenteActual: 'inc-1', cluster: null }], generador());
    expect(r.asignaciones.get('a')).toBeNull();
    expect(r.conservados.size).toBe(0);
  });
});
