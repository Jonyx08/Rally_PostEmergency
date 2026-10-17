#!/usr/bin/env node
/**
 * Simulador de "mulas de datos".
 *
 * Representa lo que en el sistema real haría el teléfono recolector de una
 * patrulla: juntar reportes de ciudadanos en la zona sin señal y, al recuperar
 * conexión, subirlos en bloque a POST /api/reportes/sync.
 *
 * Genera:
 *   - varios "focos" (derrumbes, inundaciones...) con muchos reportes casi en el
 *     mismo punto, como cuando muchos vecinos reportan lo mismo;
 *   - algunos reportes aislados;
 *   - solapamiento entre patrullas: el mismo reporte lo recogen dos mulas
 *     distintas, para demostrar que el backend no lo duplica.
 *
 * Sin dependencias: requiere Node 18+ (usa fetch y crypto.randomUUID).
 *
 * Uso:
 *   node simular.mjs [--url http://localhost:3000] [--mulas 3] [--focos 8]
 *                    [--aislados 15] [--pausa 2000] [--reset] [--semilla 42]
 */
import { randomUUID } from 'node:crypto';

// ---------- Opciones ----------
const args = process.argv.slice(2);
function opcion(nombre, porDefecto) {
  const i = args.indexOf(`--${nombre}`);
  if (i === -1) return porDefecto;
  const valor = args[i + 1];
  return valor === undefined || valor.startsWith('--') ? true : valor;
}
if (args.includes('--ayuda') || args.includes('-h')) {
  console.log(
    'Uso: node simular.mjs [--url URL] [--mulas N] [--focos N] [--aislados N] [--pausa ms] [--reset] [--semilla N]',
  );
  process.exit(0);
}

const URL_API = String(opcion('url', process.env.API_URL ?? 'http://localhost:3000')).replace(/\/$/, '');
const MULAS = Number(opcion('mulas', 3));
const FOCOS = Number(opcion('focos', 8));
const AISLADOS = Number(opcion('aislados', 15));
const PAUSA_MS = Number(opcion('pausa', 2000));
const RESET = opcion('reset', false) === true;
const SEMILLA = Number(opcion('semilla', Date.now() % 100000));

// ---------- Aleatorio reproducible (mulberry32) ----------
let estado = SEMILLA >>> 0;
function aleatorio() {
  estado = (estado + 0x6d2b79f5) >>> 0;
  let t = estado;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const entre = (min, max) => min + aleatorio() * (max - min);
const entero = (min, max) => Math.floor(entre(min, max + 1));
const elegir = (lista) => lista[Math.floor(aleatorio() * lista.length)];

// ---------- Geografía: alrededor de la ciudad de San Miguel ----------
const CENTRO = { lat: 13.4833, lng: -88.1833 };
const METROS_POR_GRADO_LAT = 111_320;
const metrosPorGradoLng = (lat) => 111_320 * Math.cos((lat * Math.PI) / 180);

/** Punto aleatorio a menos de `radio` metros de `centro`. */
function puntoCerca(centro, radio) {
  const r = radio * Math.sqrt(aleatorio());
  const angulo = aleatorio() * 2 * Math.PI;
  return {
    lat: centro.lat + (r * Math.sin(angulo)) / METROS_POR_GRADO_LAT,
    lng: centro.lng + (r * Math.cos(angulo)) / metrosPorGradoLng(centro.lat),
  };
}

// Algunos focos caen a propósito en las zonas de riesgo ficticias del seed.
const FOCOS_FIJOS = [
  { nombre: 'Derrumbe en ladera del volcán', lat: 13.4725, lng: -88.2075, tipo: 'DERRUMBE', gravedad: 3 },
  { nombre: 'Inundación junto al Río Grande', lat: 13.4605, lng: -88.1800, tipo: 'INUNDACION', gravedad: 2 },
  { nombre: 'Personas atrapadas en edificio', lat: 13.4840, lng: -88.1790, tipo: 'PERSONA_ATRAPADA', gravedad: 3 },
  { nombre: 'Incendio en mercado', lat: 13.4790, lng: -88.1760, tipo: 'INCENDIO', gravedad: 2 },
  { nombre: 'Derrumbe en quebrada norte', lat: 13.4960, lng: -88.1620, tipo: 'DERRUMBE', gravedad: 2 },
  { nombre: 'Viviendas dañadas en colonia norte', lat: 13.5020, lng: -88.1860, tipo: 'HERIDOS', gravedad: 1 },
];
const TIPOS = ['DERRUMBE', 'INUNDACION', 'INCENDIO', 'PERSONA_ATRAPADA', 'HERIDOS', 'OTRO'];
const DESCRIPCIONES = {
  DERRUMBE: ['Se vino abajo el muro', 'Casa colapsada', 'Tierra sobre la calle', 'Se escuchan voces bajo escombros'],
  INUNDACION: ['El agua llega a la cintura', 'Familia en el techo', 'La calle es un río'],
  INCENDIO: ['Mucho humo', 'Se quema un local', 'Fuego después del temblor'],
  PERSONA_ATRAPADA: ['Hay gente atrapada', 'Niño atrapado en segundo piso', 'Adulto mayor no puede salir'],
  HERIDOS: ['Varios heridos', 'Vecino con fractura', 'Necesitamos ambulancia'],
  OTRO: ['Poste caído', 'Fuga de gas', 'Calle bloqueada'],
};

function crearReporte(punto, tipo, gravedad, minutosAtras) {
  const atrapados = tipo === 'PERSONA_ATRAPADA' || (gravedad >= 3 && aleatorio() < 0.35);
  return {
    id: randomUUID(),
    deviceId: `tel-${entero(1000, 9999)}`,
    createdAt: new Date(Date.now() - minutosAtras * 60_000).toISOString(),
    lat: Number(punto.lat.toFixed(6)),
    lng: Number(punto.lng.toFixed(6)),
    tipo,
    heridos: aleatorio() < 0.5 ? 0 : entero(0, gravedad * 2),
    personasAtrapadas: atrapados,
    descripcion: aleatorio() < 0.6 ? elegir(DESCRIPCIONES[tipo]) : undefined,
  };
}

function generarReportes() {
  const reportes = [];
  const focos = [...FOCOS_FIJOS];
  while (focos.length < FOCOS) {
    const p = puntoCerca(CENTRO, 3000);
    focos.push({ nombre: 'Foco aleatorio', ...p, tipo: elegir(TIPOS), gravedad: entero(1, 3) });
  }
  for (const foco of focos.slice(0, FOCOS)) {
    const cantidad = entero(5, 15) * foco.gravedad;
    for (let i = 0; i < cantidad; i++) {
      // La mayoría reporta el tipo del foco; algunos lo describen distinto.
      const tipo = aleatorio() < 0.8 ? foco.tipo : elegir(TIPOS);
      reportes.push(crearReporte(puntoCerca(foco, 70), tipo, foco.gravedad, entero(5, 90)));
    }
  }
  for (let i = 0; i < AISLADOS; i++) {
    reportes.push(crearReporte(puntoCerca(CENTRO, 3500), elegir(TIPOS), 1, entero(5, 120)));
  }
  return { reportes, focos: focos.slice(0, FOCOS) };
}

/** Reparte los reportes entre las mulas; ~15% lo recoge además una segunda mula. */
function repartirEntreMulas(reportes) {
  const lotes = Array.from({ length: MULAS }, () => []);
  for (const r of reportes) {
    const principal = entero(0, MULAS - 1);
    lotes[principal].push(r);
    if (MULAS > 1 && aleatorio() < 0.15) {
      lotes[(principal + entero(1, MULAS - 1)) % MULAS].push(r);
    }
  }
  return lotes;
}

async function enviar(collectorId, reportes) {
  const respuesta = await fetch(`${URL_API}/api/reportes/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ collectorId, reportes }),
  });
  if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}: ${await respuesta.text()}`);
  return respuesta.json();
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(`Simulador de mulas de datos → ${URL_API}  (semilla ${SEMILLA})\n`);

  try {
    const salud = await (await fetch(`${URL_API}/api/health`)).json();
    if (salud.db !== 'ok') throw new Error(JSON.stringify(salud));
  } catch (e) {
    console.error(`No se pudo conectar con la API en ${URL_API}. ¿Está corriendo el backend?\n${e.message}`);
    process.exit(1);
  }

  if (RESET) {
    const r = await fetch(`${URL_API}/api/demo/datos`, { method: 'DELETE' });
    console.log(r.ok ? '🧹 Tablero vaciado\n' : `⚠️  No se pudo vaciar el tablero (HTTP ${r.status})\n`);
  }

  const { reportes, focos } = generarReportes();
  const lotes = repartirEntreMulas(reportes);
  console.log(`Generados ${reportes.length} reportes en ${focos.length} focos + ${AISLADOS} aislados.`);
  console.log(`Repartidos entre ${MULAS} patrullas (algunos los recogió más de una).\n`);

  for (let i = 0; i < lotes.length; i++) {
    const collectorId = `patrulla-${String(i + 1).padStart(2, '0')}`;
    console.log(`🚓 ${collectorId} sale de la zona sin señal y sincroniza ${lotes[i].length} reportes...`);
    const r = await enviar(collectorId, lotes[i]);
    console.log(
      `   → ${r.insertados} nuevos, ${r.duplicados} duplicados ignorados` +
        (r.triaje ? `, ${r.triaje.incidentes} incidentes en total` : ''),
    );
    if (i < lotes.length - 1) await esperar(PAUSA_MS);
  }

  // Reenvío del primer lote: demuestra la idempotencia.
  await esperar(PAUSA_MS);
  console.log('\n🔁 patrulla-01 reenvía su lote completo (por ejemplo, porque se cortó la conexión)...');
  const re = await enviar('patrulla-01', lotes[0]);
  console.log(`   → ${re.insertados} nuevos, ${re.duplicados} duplicados ignorados`);

  const resumen = await (await fetch(`${URL_API}/api/incidentes/resumen`)).json();
  console.log(
    `\n✅ ${resumen.reportes} reportes → ${resumen.incidentes} incidentes ` +
      `(CRÍTICA ${resumen.porNivel.CRITICA}, ALTA ${resumen.porNivel.ALTA}, ` +
      `MEDIA ${resumen.porNivel.MEDIA}, BAJA ${resumen.porNivel.BAJA})`,
  );
  console.log(`   Tablero: ${URL_API}/`);
}

main().catch((e) => {
  console.error(`Error: ${e.message}`);
  process.exit(1);
});
