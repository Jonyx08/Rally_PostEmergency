# Preguntas abiertas y puntos débiles

Lo que el equipo todavía no ha decidido, y lo que el jurado probablemente va a preguntar. Cuando algo se decida, muévelo a la sección **Decidido** con la fecha.

## Por decidir

### 1. Regla del heartbeat
**Problema:** la propuesta pide que los teléfonos de las patrullas hagan ping al COE cada 30 min y marca "colapso" si se pierden varias unidades en un cuadrante. Pero las patrullas entran **a propósito** a zonas sin señal, así que todas se verían como colapso.

**Opciones:**
- a) Quitarla del MVP y presentarla como trabajo futuro.
- b) Mantenerla como estado informativo: la patrulla pasa a `SIN_CONTACTO`, sin generar alerta.
- c) Alertar solo si una patrulla no reaparece después de un tiempo mucho mayor al esperado para su ruta.

### 2. Mapas de riesgo del MARN
¿Existen públicamente en un formato usable (GeoJSON o shapefile)? Mientras tanto, el seed carga 4 zonas ficticias alrededor de San Miguel, **marcadas como FICTICIAS** en el mapa. Si se consiguen los datos reales, se reemplazan en `backend/prisma/seed.ts`.

### 3. Responsables
Falta confirmar quién termina la PWA del ciudadano (Angular) y quién hace la presentación. El backend, el simulador y un tablero mínimo ya existen.

### 4. ¿Hay IA en el producto?
Ni la propuesta del Notion ni el documento técnico mencionan un componente de IA dentro de la app. Confirmar si se descarta o qué haría.

### 5. Tablero del COE: ¿se queda en HTML o se rehace en Angular?
Ya existe una versión mínima en `backend/public/index.html` que funciona. Rehacerlo en Angular unifica el frontend, pero le quita tiempo a la PWA del ciudadano, que todavía no tiene pantallas. Recomendación: dejar el tablero como está y concentrar Angular en la PWA.

### 6. Pesos de la prioridad
Los pesos de `backend/src/config.ts` son una propuesta razonada, no validada. Si alguien del equipo tiene contacto con Protección Civil o con cuerpos de socorro, vale la pena preguntarles qué pesa más.

## Preguntas probables del jurado

| Pregunta | Respuesta honesta / qué preparar |
|---|---|
| ¿Funciona realmente sin internet? | La captura del reporte sí (PWA offline). El transporte BLE entre teléfonos es la visión; en la demo se simula. Explicar por qué un navegador no puede emitir BLE |
| ¿BLE llega a 100 m? | Entre teléfonos, y con el vehículo en movimiento, suele ser bastante menos. Presentarlo como "decenas de metros" y que la patrulla pasa despacio o se detiene |
| ¿No dependen de Google si usan Nearby Connections? | Sí: Nearby Connections requiere Google Play Services. La alternativa son las APIs BLE nativas de Android, sin Play Services |
| ¿Cómo evitan alertas duplicadas? | Dos niveles: UUID por reporte (la misma alerta traída por dos mulas no se duplica) y clustering espacial (reportes distintos del mismo lugar se fusionan) |
| ¿Por qué esos pesos de prioridad? | Cada factor tiene un tope y los topes suman 100; el desglose se muestra en pantalla. Son configurables y se pueden calibrar con expertos |
| Si 50 vecinos reportan heridos, ¿suman 50 veces? | No: se usa el máximo que reportó una sola persona, porque todos describen a los mismos heridos. La cantidad de reportes suma confianza por separado, con tope |
| ¿Qué pasa si una patrulla manda el mismo lote dos veces? | Nada: el UUID de cada reporte lo hace idempotente. El simulador lo demuestra en vivo |
| ¿Quién usaría esto? | COE, Protección Civil, PNC, alcaldías. La API abierta permite integrarlo con sus sistemas |
| ¿Qué pasa con la privacidad de la ubicación? | Preparar una respuesta: solo se envía la ubicación del reporte, sin seguimiento continuo del ciudadano |

## Temas para estudiar (backend)

- `ST_ClusterDBSCAN`: qué significan `eps` y `minpoints`.
- `geometry` vs `geography`, y por qué importa para medir en metros.
- `ST_Intersects` / `ST_Contains` (incidente dentro de zona) y `ST_DWithin` (búsqueda por radio).
- Idempotencia y por qué el UUID se genera en el teléfono.
- Prisma + PostGIS: columnas `Unsupported(...)` y consultas con `$queryRaw`.
- Cómo se conservan los ids de los incidentes entre recálculos (`backend/src/triaje/asignacion.ts`).

## Decidido

- **2026-10-17:** el MVP es PWA en Angular + backend NestJS/Prisma/PostGIS + simulador de mulas en Node.js. La app Android nativa y el BLE real quedan fuera del MVP.
- **2026-10-17:** endpoint de sincronización: `POST /api/reportes/sync`.
- **2026-10-17:** los heridos de un incidente se estiman con el **máximo** reportado, no con la suma (campo `heridosEstimados`).
- **2026-10-17:** mientras no haya mapas del MARN, se usan 4 zonas ficticias alrededor de San Miguel, marcadas como FICTICIAS.
- **2026-10-17:** un incidente `ATENDIDO` que recibe reportes nuevos vuelve a `NUEVO`.
