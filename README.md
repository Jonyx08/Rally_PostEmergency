# Sistema de Triaje y Red Resiliente Post-Emergencia

Prototipo del equipo UNIVO para el **Rally Latinoamericano de Innovación 2026 — Desafío 09: Optimización y priorización de recursos y esfuerzos en la post-emergencia**.

![Tablero del COE con incidentes priorizados sobre San Miguel](docs/img/tablero-coe.png)

> **Estado:** el backend (API + base de datos geoespacial + triaje), la PWA del ciudadano y de las mulas de datos en Angular, el simulador y un tablero mínimo del COE **funcionan de punta a punta**. Está desplegado en Railway:

| Qué | URL |
|---|---|
| PWA del ciudadano / mula de datos | https://frontend-production-4924.up.railway.app/ |
| Tablero del COE | https://backend-production-0e878.up.railway.app/ |
| API (Swagger) | https://backend-production-0e878.up.railway.app/api/docs |

---

## Índice

1. [El problema](#1-el-problema)
2. [La solución](#2-la-solución)
3. [Qué se construye para el rally (MVP) y qué es solo visión](#3-qué-se-construye-para-el-rally-mvp-y-qué-es-solo-visión)
4. [Cómo correrlo (5 minutos)](#4-cómo-correrlo-5-minutos)
5. [Arquitectura](#5-arquitectura)
6. [Cómo funciona el triaje](#6-cómo-funciona-el-triaje)
7. [Estructura del repositorio](#7-estructura-del-repositorio)
8. [API](#8-api)
9. [Tests](#9-tests)
10. [Problemas comunes](#10-problemas-comunes)
11. [Glosario](#11-glosario)

---

## 1. El problema

Después de un terremoto, deslave o inundación severa en El Salvador pasan tres cosas que hacen colapsar la respuesta oficial:

| Problema | Qué pasa |
|---|---|
| **Aislamiento digital y físico** | Caen las torres celulares y la fibra; las rutas quedan bloqueadas. La información no sale de la "Zona Cero". |
| **Caos logístico (fatiga de alarmas)** | Cuando vuelve la señal, muchas personas reportan **el mismo** incidente. Se mandan varias unidades al mismo lugar y otros sectores quedan sin atender. |
| **Decisiones a ciegas** | Con información fragmentada, el COE (Centro de Operaciones de Emergencia) no sabe a quién atender primero ni qué recursos asignar. |

## 2. La solución

Una plataforma de software, sin hardware especial, en dos fases:

- **Fase A — Mulas de datos:** los vehículos que entran y salen de la zona (patrullas, ambulancias, vehículos de alcaldía) llevan un teléfono en *Modo Recolector* que recoge los reportes de los ciudadanos al pasar cerca y los sube al servidor cuando recupera conexión.
- **Fase B — Cerebro de triaje:** el servidor agrupa los reportes duplicados en un solo **Incidente Maestro**, lo prioriza según gravedad y zona de riesgo, y lo muestra al despachador del COE explicando *por qué* tiene esa prioridad.

```mermaid
flowchart LR
    C["📱 Ciudadano<br/>(zona sin señal)<br/>crea reporte offline"] -->|"BLE / Wi-Fi Direct<br/>(visión)"| M["🚓 Teléfono recolector<br/>en patrulla<br/>(mula de datos)"]
    M -->|"recupera 4G / Starlink<br/>POST /api/reportes/sync"| API["⚙️ API NestJS"]
    API --> DB[("🗺️ PostgreSQL<br/>+ PostGIS")]
    DB --> T["🧠 Triaje<br/>clustering + prioridad"]
    T --> COE["🖥️ Tablero del COE<br/>mapa + incidentes priorizados"]
```

## 3. Qué se construye para el rally (MVP) y qué es solo visión

| Parte | Estado | Cómo se demuestra |
|---|---|---|
| Backend con sincronización por lotes idempotente | ✅ Hecho | `backend/` — NestJS + Prisma |
| Clustering espacial y priorización | ✅ Hecho | PostGIS (`ST_ClusterDBSCAN`, `ST_Intersects`) |
| Simulador de mulas de datos | ✅ Hecho | `simulador/` — cientos de reportes en lotes, con duplicados entre patrullas |
| Tablero del COE (mapa + lista priorizada) | ✅ Hecho (mínimo) | `backend/public/index.html`, servido en `http://localhost:3000/` |
| App del ciudadano y de la mula de datos (reporte offline + sincronización) | ✅ Hecho | `frontend/` — PWA en Angular con service worker, cola local y sincronización automática al volver la conexión |
| Transferencia teléfono → teléfono por BLE / Wi-Fi Direct | ❌ Visión | La **simula** el simulador. Desde un navegador no se puede emitir BLE |
| Mapas reales de susceptibilidad del MARN | ⚠️ Pendiente | Por ahora, 4 zonas **ficticias**, marcadas así en el mapa |
| Heartbeat de patrullas | ⚠️ Sin implementar | Ver [docs/PREGUNTAS_ABIERTAS.md](docs/PREGUNTAS_ABIERTAS.md) |

**Por qué la parte BLE es solo visión:** emitir balizas BLE, escanear en segundo plano y usar Wi-Fi Direct son APIs nativas de Android. Una PWA no puede hacerlo (Web Bluetooth no emite anuncios ni escanea en segundo plano, y no existe en Safari de iPhone). En la demo, el simulador representa el viaje del reporte en la patrulla.

## 4. Cómo correrlo (5 minutos)

### Requisitos

- **Node.js 22 o superior** y **pnpm 12** (`npm install -g pnpm`)
- **Docker** con Docker Compose (para PostgreSQL + PostGIS)

### Pasos

```bash
# 1. Base de datos (PostgreSQL 15 + PostGIS 3.4 en el puerto 5432), desde la raíz del repo
docker compose up -d db-postgis

# 2. Dependencias, cliente de Prisma, tablas y zonas de riesgo de ejemplo
cd backend
cp .env.example .env
pnpm install
pnpm prisma:generate
pnpm db:migrate
pnpm db:seed

# 3. API (se queda corriendo)
pnpm start:dev
```

En otra terminal, desde la raíz del repo:

```bash
# 4. Simular 3 patrullas que llegan con ~200 reportes (vacía el tablero antes)
node simulador/simular.mjs --reset
```

Y para el frontend Angular (otra terminal):

```bash
cd frontend
pnpm install
pnpm start        # http://localhost:4200
```

En `localhost` la PWA usa el backend local (`http://localhost:3000/api`); desplegada en otro dominio, usa el de Railway. Se puede cambiar desde la pestaña de configuración de red de la propia app.

Luego abre:

| URL | Qué es |
|---|---|
| http://localhost:4200/ | PWA del ciudadano / mula de datos |
| http://localhost:3000/ | Tablero del COE |
| http://localhost:3000/api/docs | Swagger: todos los endpoints, se pueden probar desde el navegador |
| http://localhost:3000/api/health | Debe responder `{"api":"ok","db":"ok",...}` |

### Opciones del simulador

```bash
node simulador/simular.mjs --mulas 5 --focos 10 --aislados 20 --pausa 3000 --semilla 2026 --reset
```

| Opción | Por defecto | Qué hace |
|---|---|---|
| `--url` | `http://localhost:3000` | Dirección de la API |
| `--mulas` | 3 | Cantidad de patrullas que sincronizan |
| `--focos` | 8 | Incidentes simulados (6 fijos en lugares conocidos + aleatorios) |
| `--aislados` | 15 | Reportes sueltos lejos de los focos |
| `--pausa` | 2000 | Milisegundos entre una patrulla y otra (para que se vea en el tablero) |
| `--semilla` | aleatoria | Con la misma semilla se generan los mismos lugares y cantidades |
| `--reset` | no | Vacía reportes e incidentes antes de empezar |

## 5. Arquitectura

```mermaid
flowchart TB
    subgraph Clientes
        PWA["PWA ciudadano<br/>frontend/ (Angular)"]
        Sim["Simulador de mulas<br/>simulador/simular.mjs"]
        Dash["Tablero COE<br/>backend/public/index.html"]
    end
    subgraph Backend["backend/ (NestJS)"]
        Sync["ReportesController<br/>POST /api/reportes/sync"]
        Val["validacion.ts<br/>valida reporte por reporte"]
        Triaje["TriajeService<br/>DBSCAN + asignación + prioridad"]
        Inc["IncidentesController"]
        Zon["ZonasController"]
    end
    DB[("PostgreSQL + PostGIS")]

    PWA -->|lote| Sync
    Sim -->|lotes| Sync
    Sync --> Val
    Sync -->|"INSERT ... ON CONFLICT DO NOTHING"| DB
    Sync --> Triaje
    Triaje <--> DB
    Dash -->|"cada 3 s"| Inc
    Dash --> Zon
    Inc --> DB
    Zon --> DB
```

**Flujo de un reporte:**

1. El ciudadano crea el reporte. Recibe un **UUID generado en el teléfono** y se guarda localmente.
2. Cuando hay conexión (o cuando "pasa la mula"), los pendientes se envían en lote a `POST /api/reportes/sync`.
3. El backend valida cada reporte por separado (uno malo no tumba el lote) y los inserta con `ON CONFLICT (id) DO NOTHING`. Si el UUID ya existía, se ignora: dos mulas que traen el mismo reporte no lo duplican (**idempotencia**).
4. Si hubo reportes nuevos, se recalcula el triaje.
5. El tablero consulta los incidentes ordenados por prioridad cada 3 segundos.

## 6. Cómo funciona el triaje

Todo está en `backend/src/triaje/`. Los parámetros se cambian en `backend/src/config.ts` y en `backend/.env`.

### 6.1 Agrupación espacial (clustering)

Si 50 vecinos reportan el mismo derrumbe, el sistema no muestra 50 alertas: las fusiona en **1 Incidente Maestro** con `ST_ClusterDBSCAN`.

```sql
ST_ClusterDBSCAN(ST_Transform(ubicacion, 32616), eps := 100, minpoints := 1) OVER ()
```

- **`eps` = 100 m** (`TRIAJE_RADIO_METROS`): dos reportes a menos de esa distancia quedan en el mismo grupo. Es encadenado: A–B y B–C juntan a A, B y C aunque A y C estén más lejos.
- **`minpoints` = 1** (`TRIAJE_MIN_REPORTES`): un reporte aislado también es un incidente. Con 2 o más, los aislados quedan como "ruido" sin incidente.
- **Por qué `ST_Transform(..., 32616)`:** los puntos se guardan en grados (SRID 4326), y `eps` en grados no significa nada útil. Se transforman a **UTM zona 16N** (SRID 32616), que cubre El Salvador y mide en metros.

### 6.2 Incidentes estables

DBSCAN numera los grupos de nuevo en cada ejecución. Para que un incidente **conserve su id y su estado** (por ejemplo `ASIGNADO`) cuando llegan más reportes, `asignacion.ts` hace que cada grupo reutilice el incidente al que ya pertenecía la mayoría de sus reportes. Si un incidente se parte en dos, el grupo más grande se queda con el id. Si un incidente `ATENDIDO` recibe reportes nuevos, se reabre como `NUEVO`.

### 6.3 Prioridad (0–100)

Función pura en `prioridad.ts`. La suma de los máximos es exactamente 100:

| Factor | Puntos | Tope |
|---|---|---|
| Cantidad de reportes | 2 por reporte | 20 |
| Heridos estimados | 3 por herido | 25 |
| Personas atrapadas | 20 si algún reporte lo indica | 20 |
| Tipo más grave del grupo | Atrapada 15, Derrumbe 12, Incendio 12, Heridos 10, Inundación 8, Otro 3 | 15 |
| Zona de riesgo del centro (`ST_Intersects`) | Roja 20, Naranja 12, Amarilla 6 | 20 |

Niveles: **CRÍTICA ≥ 75**, **ALTA ≥ 50**, **MEDIA ≥ 25**, **BAJA** el resto.

El backend guarda el **desglose** (cuántos puntos aportó cada factor) y el tablero lo muestra como una barra de colores. Así se puede explicar *por qué* un incidente está arriba.

**Heridos estimados = máximo, no suma.** Si 24 vecinos reportan el mismo derrumbe y cada uno dice "veo 3 heridos", sumar daría 72 heridos falsos. Se usa el máximo reportado por una persona como estimación conservadora.

> Los pesos son una **propuesta razonada, no validada** con Protección Civil. Están en un solo archivo para ajustarlos fácilmente.

### 6.4 Rendimiento

En cada sincronización se recalculan **todos** los incidentes. Con ~200 reportes tarda unos 10–30 ms, suficiente para la demo. Para producción habría que hacerlo incremental (solo la zona afectada por los reportes nuevos).

## 7. Estructura del repositorio

```
/
├── README.md
├── docs/
│   ├── API.md                  ← contrato de la API (lo que consume el frontend)
│   ├── PREGUNTAS_ABIERTAS.md   ← decisiones pendientes y preguntas del jurado
│   └── img/
├── docker-compose.yml          ← PostgreSQL 15 + PostGIS 3.4
├── backend/                    ← NestJS + Prisma + PostGIS
│   ├── .env.example
│   ├── prisma/
│   │   ├── schema.prisma       ← tablas: reportes, incidentes, zonas_riesgo
│   │   ├── migrations/
│   │   └── seed.ts             ← zonas de riesgo FICTICIAS
│   ├── public/index.html       ← tablero del COE (Leaflet, sin build)
│   ├── src/
│   │   ├── main.ts             ← arranque, CORS, Swagger
│   │   ├── config.ts           ← parámetros y pesos del triaje
│   │   ├── reportes/           ← POST /api/reportes/sync + validación
│   │   ├── triaje/             ← clustering, asignación estable y prioridad
│   │   ├── incidentes/         ← listado, detalle, cambio de estado, resumen
│   │   ├── zonas/              ← zonas de riesgo en GeoJSON
│   │   ├── health/
│   │   └── demo/               ← vaciar datos antes de la demo
│   └── test/                   ← tests unitarios y de integración
├── simulador/simular.mjs       ← mulas de datos (Node, sin dependencias)
└── frontend/                   ← PWA en Angular (service worker + cola offline)
    └── src/app/
        ├── services/reporte.service.ts  ← cola local, detección de conexión y sync
        ├── models/reporte.model.ts      ← tipos del contrato de la API
        └── app.component.*              ← pantallas: reportar, mis reportes, mula, COE
```

### Notas sobre Prisma + PostGIS

Prisma no entiende los tipos geográficos de PostGIS. Las columnas espaciales (`reportes.ubicacion`, `zonas_riesgo.area`) se declaran como `Unsupported("geometry(...)")`: Prisma las crea en la migración, pero el cliente normal no las lee ni las escribe. Por eso:

- Lo **normal** (listar incidentes, cambiar estado, contar) usa el cliente de Prisma.
- Lo **espacial** (insertar puntos, clustering, zonas, GeoJSON) usa SQL crudo con `$queryRaw` / `$executeRaw`, en `reportes.service.ts`, `triaje.service.ts`, `zonas.controller.ts` y `prisma/seed.ts`.

## 8. API

Detalle completo con ejemplos en **[docs/API.md](docs/API.md)**, y documentación interactiva en `/api/docs`.

| Método | Ruta | Para qué |
|---|---|---|
| `POST` | `/api/reportes/sync` | Recibir un lote de reportes. Idempotente por `id` |
| `GET` | `/api/reportes` | Reportes individuales (puntos del mapa) |
| `GET` | `/api/incidentes` | Incidentes por prioridad (`?estado=NUEVO` opcional) |
| `GET` | `/api/incidentes/resumen` | Totales para el tablero |
| `GET` | `/api/incidentes/:id` | Detalle con sus reportes |
| `PATCH` | `/api/incidentes/:id` | Cambiar estado |
| `GET` | `/api/zonas-riesgo` | Zonas en GeoJSON |
| `GET` | `/api/health` | Estado de la API, la base y PostGIS |
| `DELETE` | `/api/demo/datos` | Vaciar el tablero (solo con `DEMO_PERMITIR_RESET=true`) |

**Frontend:** la PWA consume esta API desde `frontend/src/app/services/reporte.service.ts`. CORS permite `http://localhost:4200` (el puerto de `pnpm start`); si la PWA se despliega en otro dominio, hay que agregarlo a `CORS_ORIGINS`.

## 9. Tests

```bash
cd backend
pnpm test:unit
```

Tests unitarios (sin base de datos): prioridad, validación de reportes y asignación estable de incidentes.

Los **tests de integración** prueban contra PostGIS real: idempotencia del sync, lote con reportes inválidos, clustering a 100 m, heridos por máximo, zona roja, conservación del estado y reapertura. Usan una base **aparte**, porque borran datos:

```bash
cd backend
docker compose -f ../docker-compose.yml exec db-postgis psql -U postgres -c "CREATE DATABASE triajedb_test"
DATABASE_URL="postgresql://postgres:rallypassword123@localhost:5432/triajedb_test" pnpm db:migrate
TEST_DATABASE_URL="postgresql://postgres:rallypassword123@localhost:5432/triajedb_test" pnpm test
```

Sin `TEST_DATABASE_URL`, los tests de integración se saltan automáticamente.

## 10. Problemas comunes

| Síntoma | Causa probable / solución |
|---|---|
| `docker compose up` falla con "port 5432 already in use" | Hay otro PostgreSQL local. Detenlo, o cambia el puerto en el `docker-compose.yml` de la raíz (por ejemplo `"5433:5432"`) y en `DATABASE_URL` de `backend/.env` |
| `@prisma/client did not initialize yet` | Falta `pnpm prisma:generate` |
| `relation "reportes" does not exist` | Falta `pnpm db:migrate` |
| El tablero dice "Sin conexión con la API" | El backend no está corriendo, o está en otro puerto |
| `/api/zonas-riesgo` devuelve una lista vacía | Falta `pnpm db:seed` |
| `DELETE /api/demo/datos` responde 403 | Falta `DEMO_PERMITIR_RESET=true` en `backend/.env` |
| pnpm falla con `ERR_PNPM_IGNORED_BUILDS` | Una dependencia nueva quiere ejecutar scripts. Agrégala en `allowBuilds` del `pnpm-workspace.yaml` de esa carpeta (`true` o `false`) |

## 11. Glosario

| Término | Significado |
|---|---|
| **COE** | Centro de Operaciones de Emergencia |
| **Mula de datos** | Dispositivo que transporta información físicamente entre una zona sin conexión y una con conexión (*store-and-forward*) |
| **Incidente Maestro** | Grupo de reportes cercanos que el sistema trata como un solo incidente |
| **Triaje** | Clasificar y ordenar por prioridad a quién atender primero |
| **Idempotente** | Enviar lo mismo varias veces produce el mismo resultado que enviarlo una vez |
| **DBSCAN** | Algoritmo de agrupamiento por densidad: junta puntos que están a menos de `eps` entre sí |
| **SRID** | Identificador del sistema de coordenadas. 4326 = grados (GPS); 32616 = metros (UTM 16N) |
| **PostGIS** | Extensión de PostgreSQL para datos geográficos |
| **PWA** | *Progressive Web App*: app web instalable que puede funcionar offline |
| **BLE** | *Bluetooth Low Energy* |
| **MARN** | Ministerio de Medio Ambiente y Recursos Naturales de El Salvador |




