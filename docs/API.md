# Contrato de la API (propuesta v0.1)

Este documento es el **acuerdo entre frontend y backend**. Mientras el backend no exista, el frontend puede trabajar con datos falsos que tengan exactamente esta forma.

> **Estado:** propuesta. Para cambiar algo, abre un PR que modifique este archivo y avisa al equipo, así nadie construye contra una versión vieja.

## Convenciones

- Base URL en desarrollo: `http://localhost:3000`
- Todas las rutas empiezan con `/api`.
- JSON en request y response. Fechas en ISO 8601 UTC (`2026-10-17T06:00:00Z`).
- Coordenadas en grados decimales WGS84: `lat` (latitud) y `lng` (longitud).
- Sin autenticación en el MVP.
- CORS habilitado para `http://localhost:4200` (servidor de desarrollo de Angular).

## Valores permitidos (enums)

| Campo | Valores |
|---|---|
| `tipo` | `DERRUMBE`, `INUNDACION`, `INCENDIO`, `PERSONA_ATRAPADA`, `HERIDOS`, `OTRO` |
| `estado` (incidente) | `NUEVO`, `ASIGNADO`, `ATENDIDO` |
| `nivelPrioridad` | `CRITICA`, `ALTA`, `MEDIA`, `BAJA` |
| `nivel` (zona de riesgo) | `ROJO`, `NARANJA`, `AMARILLO` |

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
| `collectorId` | string \| null | No | Mula que trajo el lote. `null` si sincroniza el propio teléfono del ciudadano |
| `reportes[].id` | UUID v4 | Sí | **Generado en el teléfono**. Clave de idempotencia |
| `reportes[].deviceId` | string | Sí | Identificador del dispositivo que creó el reporte |
| `reportes[].createdAt` | ISO 8601 | Sí | Momento en que se creó en el teléfono, no cuando llegó |
| `reportes[].lat` / `lng` | number | Sí | Rango válido: lat −90..90, lng −180..180 |
| `reportes[].tipo` | enum | Sí | Ver tabla de enums |
| `reportes[].heridos` | integer ≥ 0 | Sí | |
| `reportes[].personasAtrapadas` | boolean | Sí | |
| `reportes[].descripcion` | string | No | Máximo 280 caracteres |

### Response `200 OK`

```json
{
  "insertados": 1,
  "duplicados": 0,
  "invalidos": []
}
```

Con un reporte inválido:

```json
{
  "insertados": 3,
  "duplicados": 1,
  "invalidos": [
    { "id": "a1b2...", "error": "lat fuera de rango" }
  ]
}
```

### Reglas

- **Idempotente:** si ya existe un reporte con ese `id`, se ignora y cuenta como `duplicados`. Reenviar el mismo lote nunca crea duplicados.
- **Un reporte inválido no tumba el lote:** se rechaza solo ese reporte y aparece en `invalidos`; el resto se inserta.
- Después de insertar, el backend recalcula el triaje.

### Ejemplo con curl

```bash
curl -X POST http://localhost:3000/api/reportes/sync \
  -H 'Content-Type: application/json' \
  -d '{"collectorId":null,"reportes":[{"id":"5f0c2b9e-8a3d-4c1e-9b7a-2d6f1e0a4c33","deviceId":"tel-1","createdAt":"2026-10-17T06:00:00Z","lat":13.4833,"lng":-88.1833,"tipo":"DERRUMBE","heridos":2,"personasAtrapadas":true}]}'
```

---

## `GET /api/incidentes`

Lista de incidentes ordenada por `prioridad` descendente.

Query params opcionales: `estado` (por ejemplo `?estado=NUEVO`).

### Response `200 OK`

```json
[
  {
    "id": "c3d4e5f6-0000-4000-8000-000000000001",
    "lat": 13.4836,
    "lng": -88.1829,
    "radioMetros": 85,
    "cantidadReportes": 47,
    "totalHeridos": 12,
    "hayAtrapados": true,
    "tipoPrincipal": "DERRUMBE",
    "prioridad": 92,
    "nivelPrioridad": "CRITICA",
    "desglosePrioridad": {
      "reportes": 30,
      "heridos": 25,
      "atrapados": 20,
      "tipo": 7,
      "zonaRiesgo": 10
    },
    "zonaRiesgo": { "id": "z1", "nombre": "Ladera norte (FICTICIA)", "nivel": "ROJO" },
    "estado": "NUEVO",
    "actualizadoEn": "2026-10-17T06:05:12Z"
  }
]
```

`zonaRiesgo` es `null` si el incidente no cae en ninguna zona. Los nombres de los componentes de `desglosePrioridad` pueden ajustarse cuando se definan los pesos finales.

---

## `GET /api/incidentes/:id`

Igual que un elemento de la lista anterior, más el arreglo `reportes` con los reportes que forman el incidente (misma forma que en el sync, más `recibidoEn` y `collectorId`).

---

## `PATCH /api/incidentes/:id`

Cambia el estado de un incidente desde el tablero.

```json
{ "estado": "ASIGNADO" }
```

Responde el incidente actualizado.

---

## `GET /api/zonas-riesgo`

Zonas de riesgo como **GeoJSON FeatureCollection**, listas para pintar en el mapa.

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "id": "z1", "nombre": "Ladera norte (FICTICIA)", "nivel": "ROJO" },
      "geometry": { "type": "Polygon", "coordinates": [[[-88.19, 13.49], [-88.18, 13.49], [-88.18, 13.48], [-88.19, 13.48], [-88.19, 13.49]]] }
    }
  ]
}
```

> En GeoJSON el orden de coordenadas es **`[lng, lat]`**, al revés que en el resto de la API. Es fuente común de errores en el mapa.

---

## `GET /api/health`

```json
{ "api": "ok", "db": "ok" }
```

---

## Fuera del MVP (posibles extensiones)

- `POST /api/colectores/:id/heartbeat`: check-in de patrullas. Depende de cómo se resuelva la regla del heartbeat (ver `PREGUNTAS_ABIERTAS.md`).
- Autenticación con API key para las mulas.
