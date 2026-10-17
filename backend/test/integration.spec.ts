/**
 * Pruebas de integración contra una base PostgreSQL + PostGIS real.
 *
 * Usan TEST_DATABASE_URL (NUNCA la base de desarrollo), porque borran todos los
 * reportes e incidentes. Si TEST_DATABASE_URL no está definida, se saltan.
 * Ver la sección "Tests" del README para crear la base de pruebas.
 */
import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

const URL_PRUEBAS = process.env.TEST_DATABASE_URL;
const describirSiHayBase = URL_PRUEBAS ? describe : describe.skip;

// Punto dentro de la zona ROJA ficticia "z-ladera-volcan" del seed.
const EN_ZONA_ROJA = { lat: 13.472, lng: -88.208 };
// Punto lejos de cualquier zona.
const FUERA_DE_ZONA = { lat: 13.484, lng: -88.18 };

function reporte(punto: { lat: number; lng: number }, extra: Record<string, unknown> = {}) {
  return {
    id: randomUUID(),
    deviceId: 'tel-test',
    createdAt: new Date().toISOString(),
    lat: punto.lat,
    lng: punto.lng,
    tipo: 'DERRUMBE',
    heridos: 1,
    personasAtrapadas: false,
    ...extra,
  };
}

/** Desplaza un punto unos metros hacia el norte. */
function aMetrosAlNorte(punto: { lat: number; lng: number }, metros: number) {
  return { lat: punto.lat + metros / 111_320, lng: punto.lng };
}

describirSiHayBase('Integración con PostGIS', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    process.env.DATABASE_URL = URL_PRUEBAS;
    process.env.DEMO_PERMITIR_RESET = 'true';
    const { crearApp } = await import('../src/main');
    app = await crearApp();
    await app.init();
    http = request(app.getHttpServer());

    // Zonas de riesgo: se carga una zona roja mínima equivalente a la del seed.
    const { PrismaService } = await import('../src/prisma/prisma.service');
    const prisma = app.get(PrismaService);
    await prisma.$executeRaw`
      INSERT INTO zonas_riesgo (id, nombre, nivel, area)
      VALUES ('z-ladera-volcan', 'Zona roja de prueba', 'ROJO',
              ST_GeomFromText('POLYGON((-88.2165 13.4655, -88.2025 13.4630, -88.1960 13.4720, -88.1990 13.4800, -88.2120 13.4815, -88.2190 13.4740, -88.2165 13.4655))', 4326))
      ON CONFLICT (id) DO NOTHING`;
  });

  beforeEach(async () => {
    await http.delete('/api/demo/datos').expect(200);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('el sync es idempotente: reenviar el mismo lote no duplica', async () => {
    const lote = { collectorId: 'patrulla-01', reportes: [reporte(FUERA_DE_ZONA), reporte(EN_ZONA_ROJA)] };

    const primero = await http.post('/api/reportes/sync').send(lote).expect(200);
    expect(primero.body).toMatchObject({ insertados: 2, duplicados: 0, invalidos: [] });

    const segundo = await http.post('/api/reportes/sync').send(lote).expect(200);
    expect(segundo.body).toMatchObject({ insertados: 0, duplicados: 2, triaje: null });

    const resumen = await http.get('/api/incidentes/resumen').expect(200);
    expect(resumen.body.reportes).toBe(2);
  });

  it('un reporte inválido no tumba el lote', async () => {
    const lote = { reportes: [reporte(FUERA_DE_ZONA), { ...reporte(FUERA_DE_ZONA), lat: 999 }] };
    const r = await http.post('/api/reportes/sync').send(lote).expect(200);
    expect(r.body.insertados).toBe(1);
    expect(r.body.invalidos).toHaveLength(1);
    expect(r.body.invalidos[0].error).toContain('lat');
  });

  it('reportes a menos de 100 m forman un solo incidente; uno lejano forma otro', async () => {
    const cerca = [0, 30, 60].map((m) => reporte(aMetrosAlNorte(FUERA_DE_ZONA, m)));
    const lejos = reporte(aMetrosAlNorte(FUERA_DE_ZONA, 800));
    await http.post('/api/reportes/sync').send({ reportes: [...cerca, lejos] }).expect(200);

    const incidentes = (await http.get('/api/incidentes').expect(200)).body;
    expect(incidentes).toHaveLength(2);
    const conteos = incidentes.map((i: { cantidadReportes: number }) => i.cantidadReportes).sort();
    expect(conteos).toEqual([1, 3]);
  });

  it('los heridos se estiman con el máximo, no con la suma', async () => {
    const lote = [2, 3, 1].map((h) => reporte(FUERA_DE_ZONA, { heridos: h }));
    await http.post('/api/reportes/sync').send({ reportes: lote }).expect(200);
    const [incidente] = (await http.get('/api/incidentes').expect(200)).body;
    expect(incidente.heridosEstimados).toBe(3);
  });

  it('un incidente en zona ROJA queda por encima del mismo incidente fuera de zona', async () => {
    await http
      .post('/api/reportes/sync')
      .send({ reportes: [reporte(EN_ZONA_ROJA), reporte(FUERA_DE_ZONA)] })
      .expect(200);

    const [primero, segundo] = (await http.get('/api/incidentes').expect(200)).body;
    expect(primero.zonaRiesgo?.nivel).toBe('ROJO');
    expect(segundo.zonaRiesgo).toBeNull();
    expect(primero.prioridad - segundo.prioridad).toBe(20);
  });

  it('un incidente conserva su id y su estado cuando llegan más reportes', async () => {
    await http.post('/api/reportes/sync').send({ reportes: [reporte(FUERA_DE_ZONA)] }).expect(200);
    const [antes] = (await http.get('/api/incidentes').expect(200)).body;
    await http.patch(`/api/incidentes/${antes.id}`).send({ estado: 'ASIGNADO' }).expect(200);

    await http
      .post('/api/reportes/sync')
      .send({ reportes: [reporte(aMetrosAlNorte(FUERA_DE_ZONA, 20))] })
      .expect(200);

    const [despues] = (await http.get('/api/incidentes').expect(200)).body;
    expect(despues.id).toBe(antes.id);
    expect(despues.estado).toBe('ASIGNADO');
    expect(despues.cantidadReportes).toBe(2);
  });

  it('un incidente ATENDIDO se reabre si llegan reportes nuevos', async () => {
    await http.post('/api/reportes/sync').send({ reportes: [reporte(FUERA_DE_ZONA)] }).expect(200);
    const [inc] = (await http.get('/api/incidentes').expect(200)).body;
    await http.patch(`/api/incidentes/${inc.id}`).send({ estado: 'ATENDIDO' }).expect(200);

    await http.post('/api/reportes/sync').send({ reportes: [reporte(FUERA_DE_ZONA)] }).expect(200);
    const detalle = (await http.get(`/api/incidentes/${inc.id}`).expect(200)).body;
    expect(detalle.estado).toBe('NUEVO');
    expect(detalle.reportes).toHaveLength(2);
  });

  it('rechaza un estado inválido', async () => {
    await http.post('/api/reportes/sync').send({ reportes: [reporte(FUERA_DE_ZONA)] }).expect(200);
    const [inc] = (await http.get('/api/incidentes').expect(200)).body;
    await http.patch(`/api/incidentes/${inc.id}`).send({ estado: 'CERRADO' }).expect(400);
  });

  it('health responde con la base y PostGIS', async () => {
    const r = await http.get('/api/health').expect(200);
    expect(r.body).toMatchObject({ api: 'ok', db: 'ok' });
  });
});
