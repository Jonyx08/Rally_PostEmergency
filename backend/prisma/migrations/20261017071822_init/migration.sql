-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateEnum
CREATE TYPE "TipoEmergencia" AS ENUM ('DERRUMBE', 'INUNDACION', 'INCENDIO', 'PERSONA_ATRAPADA', 'HERIDOS', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoIncidente" AS ENUM ('NUEVO', 'ASIGNADO', 'ATENDIDO');

-- CreateEnum
CREATE TYPE "NivelPrioridad" AS ENUM ('CRITICA', 'ALTA', 'MEDIA', 'BAJA');

-- CreateEnum
CREATE TYPE "NivelRiesgo" AS ENUM ('ROJO', 'NARANJA', 'AMARILLO');

-- CreateTable
CREATE TABLE "reportes" (
    "id" UUID NOT NULL,
    "device_id" TEXT NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL,
    "recibido_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "ubicacion" geometry(Point, 4326),
    "tipo" "TipoEmergencia" NOT NULL,
    "heridos" INTEGER NOT NULL,
    "personas_atrapadas" BOOLEAN NOT NULL,
    "descripcion" VARCHAR(280),
    "collector_id" TEXT,
    "incidente_id" UUID,

    CONSTRAINT "reportes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incidentes" (
    "id" UUID NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "radio_metros" DOUBLE PRECISION NOT NULL,
    "cantidad_reportes" INTEGER NOT NULL,
    "heridos_estimados" INTEGER NOT NULL,
    "hay_atrapados" BOOLEAN NOT NULL,
    "tipo_principal" "TipoEmergencia" NOT NULL,
    "prioridad" INTEGER NOT NULL,
    "nivel_prioridad" "NivelPrioridad" NOT NULL,
    "desglose_prioridad" JSONB NOT NULL,
    "zona_riesgo_id" TEXT,
    "estado" "EstadoIncidente" NOT NULL DEFAULT 'NUEVO',
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "incidentes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zonas_riesgo" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nivel" "NivelRiesgo" NOT NULL,
    "area" geometry(Polygon, 4326) NOT NULL,

    CONSTRAINT "zonas_riesgo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reportes_ubicacion_idx" ON "reportes" USING GIST ("ubicacion");

-- CreateIndex
CREATE INDEX "reportes_incidente_id_idx" ON "reportes"("incidente_id");

-- CreateIndex
CREATE INDEX "incidentes_prioridad_idx" ON "incidentes"("prioridad");

-- CreateIndex
CREATE INDEX "zonas_riesgo_area_idx" ON "zonas_riesgo" USING GIST ("area");

-- AddForeignKey
ALTER TABLE "reportes" ADD CONSTRAINT "reportes_incidente_id_fkey" FOREIGN KEY ("incidente_id") REFERENCES "incidentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incidentes" ADD CONSTRAINT "incidentes_zona_riesgo_id_fkey" FOREIGN KEY ("zona_riesgo_id") REFERENCES "zonas_riesgo"("id") ON DELETE SET NULL ON UPDATE CASCADE;
