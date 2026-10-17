# Backend — API de triaje

NestJS + Prisma + PostgreSQL/PostGIS. Recibe reportes en lote, los agrupa en incidentes y los prioriza.

La guía completa (instalación, arquitectura, cómo funciona el triaje, tests y demo) está en el **[README de la raíz](../README.md)**. El contrato de la API está en **[docs/API.md](../docs/API.md)**.

## Arranque rápido

```bash
# desde la raíz del repo
docker compose up -d db-postgis

cd backend
cp .env.example .env
pnpm install
pnpm prisma:generate
pnpm db:migrate
pnpm db:seed
pnpm start:dev
```

- API: http://localhost:3000/api
- Swagger: http://localhost:3000/api/docs
- Tablero del COE: http://localhost:3000/

## Scripts

| Script | Qué hace |
|---|---|
| `pnpm start:dev` | API con recarga automática |
| `pnpm build` / `pnpm start` | Compilar y correr la versión compilada |
| `pnpm db:up` | Levantar la base (usa el `docker-compose.yml` de la raíz) |
| `pnpm db:migrate` | Aplicar migraciones |
| `pnpm db:migrate:dev` | Crear una migración nueva después de cambiar `prisma/schema.prisma` |
| `pnpm db:seed` | Cargar las zonas de riesgo (ficticias) |
| `pnpm db:reset` | Borrar todo, migrar de nuevo y cargar el seed |
| `pnpm test:unit` | Tests sin base de datos |
| `pnpm test` | Todos los tests (los de integración requieren `TEST_DATABASE_URL`) |
| `pnpm lint:types` | Revisar tipos sin compilar |

## Dónde está cada cosa

| Carpeta | Contenido |
|---|---|
| `src/reportes/` | `POST /api/reportes/sync` y validación de reportes |
| `src/triaje/` | Clustering (`ST_ClusterDBSCAN`), asignación estable de incidentes y prioridad |
| `src/incidentes/` | Listado, detalle, cambio de estado y resumen |
| `src/zonas/` | Zonas de riesgo en GeoJSON |
| `src/config.ts` | Parámetros y pesos del triaje |
| `prisma/` | Esquema, migraciones y seed |
| `public/index.html` | Tablero mínimo del COE |
| `test/` | Tests unitarios y de integración |
