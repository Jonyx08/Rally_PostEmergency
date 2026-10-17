/**
 * Carga zonas de riesgo FICTICIAS alrededor de la ciudad de San Miguel.
 *
 * IMPORTANTE: estos polígonos son inventados para la demo. NO son datos del MARN.
 * Cuando se consigan los mapas oficiales de susceptibilidad, se reemplazan aquí
 * (o se importan desde GeoJSON con ST_GeomFromGeoJSON).
 *
 * Es idempotente: se puede correr varias veces.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

type Nivel = 'ROJO' | 'NARANJA' | 'AMARILLO';

interface Zona {
  id: string;
  nombre: string;
  nivel: Nivel;
  /** Anillo del polígono en [lng, lat]; el último punto se cierra solo. */
  anillo: [number, number][];
}

const ZONAS: Zona[] = [
  {
    id: 'z-ladera-volcan',
    nombre: 'Ladera del volcán Chaparrastique (FICTICIA)',
    nivel: 'ROJO',
    anillo: [
      [-88.2165, 13.4655],
      [-88.2025, 13.4630],
      [-88.1960, 13.4720],
      [-88.1990, 13.4800],
      [-88.2120, 13.4815],
      [-88.2190, 13.4740],
    ],
  },
  {
    id: 'z-rio-grande',
    nombre: 'Ribera del Río Grande de San Miguel (FICTICIA)',
    nivel: 'NARANJA',
    anillo: [
      [-88.1905, 13.4545],
      [-88.1700, 13.4560],
      [-88.1690, 13.4655],
      [-88.1890, 13.4670],
    ],
  },
  {
    id: 'z-quebrada-norte',
    nombre: 'Quebrada al nororiente (FICTICIA)',
    nivel: 'NARANJA',
    anillo: [
      [-88.1700, 13.4900],
      [-88.1560, 13.4890],
      [-88.1545, 13.5020],
      [-88.1680, 13.5045],
    ],
  },
  {
    id: 'z-colonias-norte',
    nombre: 'Colonias del norte (FICTICIA)',
    nivel: 'AMARILLO',
    anillo: [
      [-88.1960, 13.4950],
      [-88.1760, 13.4945],
      [-88.1750, 13.5100],
      [-88.1955, 13.5110],
    ],
  },
];

function aWkt(anillo: [number, number][]): string {
  const cerrado = [...anillo, anillo[0]];
  return `POLYGON((${cerrado.map(([lng, lat]) => `${lng} ${lat}`).join(', ')}))`;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    for (const z of ZONAS) {
      await prisma.$executeRaw`
        INSERT INTO zonas_riesgo (id, nombre, nivel, area)
        VALUES (${z.id}, ${z.nombre}, ${z.nivel}::"NivelRiesgo", ST_GeomFromText(${aWkt(z.anillo)}, 4326))
        ON CONFLICT (id) DO UPDATE
          SET nombre = EXCLUDED.nombre, nivel = EXCLUDED.nivel, area = EXCLUDED.area`;
    }
    console.log(`Zonas de riesgo cargadas: ${ZONAS.length} (FICTICIAS)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
