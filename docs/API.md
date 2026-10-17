# Contrato de la API (v0.2)

Este documento es el **acuerdo entre frontend y backend**, y describe lo que el backend de `backend/` ya implementa. Con el backend corriendo, la documentación interactiva (Swagger) está en **http://localhost:3000/api/docs**.

> Para cambiar el contrato, abre un PR que modifique este archivo **y** el código, y avisa al equipo.

## Convenciones

- Base URL en desarrollo: `http://localhost:3000`
- Todas las rutas empiezan con `/api`.
- JSON en request y response. Fechas en ISO 8601 UTC (`2026-10-17T06:00:00Z`).
- Coordenadas en grados decimales WGS84: `lat` y `lng`.
- Sin autenticación en el MVP.
- CORS: por defecto se permite `http://localhost:4200` (servidor de desarrollo de Angular). Se cambia con `CORS_ORIGINS` en `backend/.env`.

## Valores permitidos (enums)

| Campo | Valores |
|---|---|
| `tipo` | `DERRUMBE`, `INUNDACION`, `INCENDIO`, `PERSONA_ATRAPADA`, `HERIDOS`, `OTRO` |
| `estado` (incidente) | `NUEVO`, `ASIGNADO`, `ATENDIDO` |
| `nivelPrioridad` | `CRITICA` (≥75), `ALTA` (≥50), `MEDIA` (≥25), `BAJA` |
| `nivel` (zona de riesgo) | `ROJO`, `NARANJA`, `AMARILLO` |

## Resumen de rutas

| Método | Ruta | Para qué |
|---|---|---|
| `POST` | `/api/reportes/sync` | Recibir un lote de reportes (PWA o mula). Idempotente |
| `GET` | `/api/reportes` | Últimos reportes individuales (puntos del mapa) |
| `GET` | `/api/incidentes` | Incidentes ordenados por prioridad |
| `GET` | `/api/incidentes/resumen` | Totales para la cabecera del tablero |
| `GET` | `/api/incidentes/:id` | Detalle de un incidente con sus reportes |
| `PATCH` | `/api/incidentes/:id` | Cambiar estado |
| `GET` | `/api/zonas-riesgo` | Zonas de riesgo en GeoJSON |
| `GET` | `/api/health` | Estado de la API, la base y PostGIS |
| `DELETE` | `/api/demo/datos` | Vaciar reportes e incidentes (solo con `DEMO_PERMITIR_RESET=true`) |

---

## `POST /api/reportes/sync`

Recibe un lote de reportes, enviado por la PWA del ciudadano o por una mula de datos.

### Request

```json
{
  "collectorId": "patrulla-01",
  "reportes": [
    {
      "id": "5f0c2b9e-8a3d-4c1e-9b7a-2d6f1e0a4c33",
      "deviceId": "tel-ciudadano-123",
      "createdAt": "2026-10-17T06:00:00Z",
      "lat": 13.4833,
      "lng": -88.1833,
      "tipo": "DERRUMBE",
      "heridos": 2,
      "personasAtrapadas": true,
      "descripcion": "Casa colapsada, se escuchan voces"
    }
  ]
}
```

| Campo | Tipo | Obligatorio | Notas |
|---|---|---|---|
| `collectorId` | string \| null | No | Mula que trajo el lote. `null` u omitido si sincroniza el propio teléfono |
| `reportes` | arreglo | Sí | Máximo 5000 por lote |
| `reportes[].id` | UUID | Sí | **Generado en el teléfono** (`crypto.randomUUID()`). Clave de idempotencia |
| `reportes[].deviceId` | string | Sí | Hasta 100 caracteres |
| `reportes[].createdAt` | ISO 8601 | Sí | Momento en que se creó en el teléfono, no cuando llegó |
| `reportes[].lat` / `lng` | number | Sí | lat −90..90, lng −180..180 |
| `reportes[].tipo` | enum | Sí | Ver tabla de enums |
| `reportes[].heridos` | entero ≥ 0 | Sí | Heridos que ve **esta** persona |
| `reportes[].personasAtrapadas` | boolean | Sí | |
| `reportes[].descripcion` | string | No | Máximo 280 caracteres |

### Response `200 OK`

```json
{
  "insertados": 3,
  "duplicados": 1,
  "invalidos": [
    { "id": "a1b2...", "error": "lat fuera de rango" }
  ],
  "triaje": {
    "incidentes": 12,
    "nuevos": 2,
    "actualizados": 10,
    "eliminados": 0,
    "reportesSinIncidente": 0
  }
}
```

- `triaje` es `null` si el lote no trajo reportes nuevos (no hizo falta recalcular).
- `400 Bad Request` solo si el cuerpo completo está mal formado (por ejemplo, `reportes` no es un arreglo).

### Reglas

- **Idempotente:** si ya existe un reporte con ese `id`, se ignora y cuenta como `duplicados`. Reenviar el mismo lote nunca crea duplicados. Esto también cubre el caso de dos mulas que recogen el mismo reporte.
- **Un reporte inválido no tumba el lote:** se rechaza solo ese reporte y aparece en `invalidos`.
- Después de insertar, el backend recalcula el triaje de todos los reportes.

### Ejemplo con curl

```bash
curl -X POST http://localhost:3000/api/reportes/sync \
  -H 'Content-Type: application/json' \
  -d '{"collectorId":null,"reportes":[{"id":"5f0c2b9e-8a3d-4c1e-9b7a-2d6f1e0a4c33","deviceId":"tel-1","createdAt":"2026-10-17T06:00:00Z","lat":13.4833,"lng":-88.1833,"tipo":"DERRUMBE","heridos":2,"personasAtrapadas":true}]}'
```

### Qué debe hacer la PWA

1. Al crear un reporte, generar `id` con `crypto.randomUUID()` y guardarlo en `IndexedDB` como pendiente.
2. Cuando haya conexión, enviar todos los pendientes en un solo lote.
3. Marcar como enviados los que vuelvan contados en `insertados` **o** en `duplicados` (los dos significan "el servidor ya lo tiene").
4. Mostrar al usuario los que vuelvan en `invalidos`.

---

## `GET /api/reportes?limite=2000`

Últimos reportes individuales, para dibujar los puntos en el mapa. `limite` entre 1 y 10000 (por defecto 2000).

```json
[
  {
    "id": "5f0c2b9e-8a3d-4c1e-9b7a-2d6f1e0a4c33",
    "lat": 13.4833,
    "lng": -88.1833,
    "tipo": "DERRUMBE",
    "heridos": 2,
    "personasAtrapadas": true,
    "incidenteId": "c3d4e5f6-0000-4000-8000-000000000001",
    "collectorId": "patrulla-01",
    "recibidoEn": "2026-10-17T06:05:12.000Z",
    "createdAt": "2026-10-17T06:00:00.000Z"
  }
]
```

---

## `GET /api/incidentes`

Incidentes ordenados por `prioridad` descendente. Query param opcional: `estado` (por ejemplo `?estado=NUEVO`).

```json
[
  {
    "id": "c3d4e5f6-0000-4000-8000-000000000001",
    "lat": 13.4725,
    "lng": -88.2075,
    "radioMetros": 64.3,
    "cantidadReportes": 24,
    "heridosEstimados": 6,
    "hayAtrapados": true,
    "tipoPrincipal": "DERRUMBE",
    "prioridad": 90,
    "nivelPrioridad": "CRITICA",
    "desglosePrioridad": {
      "reportes": 20,
      "heridos": 18,
      "atrapados": 20,
      "tipo": 12,
      "zonaRiesgo": 20
    },
    "zonaRiesgo": { "id": "z-ladera-volcan", "nombre": "Ladera del volcán Chaparrastique (FICTICIA)", "nivel": "ROJO" },
    "estado": "NUEVO",
    "creadoEn": "2026-10-17T06:05:12.000Z",
    "actualizadoEn": "2026-10-17T06:05:12.000Z"
  }
]
```

| Campo | Significado |
|---|---|
| `lat` / `lng` | Centro del grupo de reportes |
| `radioMetros` | Distancia del centro al reporte más lejano del grupo |
| `heridosEstimados` | **Máximo** de heridos que reportó una sola persona. No se suman: varios vecinos que reportan el mismo derrumbe describen a los mismos heridos |
| `tipoPrincipal` | El tipo más grave entre los reportes del grupo |
| `desglosePrioridad` | Puntos que aportó cada factor. Siempre suma `prioridad` |
| `zonaRiesgo` | Zona donde cae el centro del incidente (la de mayor nivel si hay varias), o `null` |

---

## `GET /api/incidentes/resumen`

```json
{
  "reportes": 212,
  "incidentes": 23,
  "porNivel": { "CRITICA": 1, "ALTA": 6, "MEDIA": 7, "BAJA": 9 },
  "porEstado": { "NUEVO": 23, "ASIGNADO": 0, "ATENDIDO": 0 }
}
```

---

## `GET /api/incidentes/:id`

Igual que un elemento de la lista, más `reportes`: los reportes que forman el incidente (con `deviceId`, `descripcion`, `collectorId`, `createdAt` y `recibidoEn`). `404` si no existe; `400` si el id no es un UUID.

---

## `PATCH /api/incidentes/:id`

```json
{ "estado": "ASIGNADO" }
```

Responde el incidente actualizado. `400` si el estado no es válido.

> Si un incidente está `ATENDIDO` y llegan reportes nuevos del mismo lugar, el backend lo **reabre** (vuelve a `NUEVO`).

---

## `GET /api/zonas-riesgo`

GeoJSON `FeatureCollection`, listo para pintar en el mapa.

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "id": "z-ladera-volcan", "nombre": "Ladera del volcán Chaparrastique (FICTICIA)", "nivel": "ROJO" },
      "geometry": { "type": "Polygon", "coordinates": [[[-88.2165, 13.4655], [-88.2025, 13.463], "..."]] }
    }
  ]
}
```

> En GeoJSON el orden es **`[lng, lat]`**, al revés que en el resto de la API. Es una fuente común de errores en el mapa.

---

## `GET /api/health`

```json
{ "api": "ok", "db": "ok", "postgis": "3.4.2" }
```

---

## `DELETE /api/demo/datos`

Borra todos los reportes e incidentes y conserva las zonas de riesgo. Sirve para empezar la demo con el tablero vacío. Responde `403` salvo que `DEMO_PERMITIR_RESET=true` esté en `backend/.env`.

---

## Fuera del MVP

- `POST /api/colectores/:id/heartbeat`: check-in de patrullas. Depende de cómo se resuelva la regla del heartbeat (ver `PREGUNTAS_ABIERTAS.md`).
- Autenticación con API key para las mulas.
