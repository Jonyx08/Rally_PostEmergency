import { Controller, Post, Body } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Controller('api/reportes')
export class ReportesController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('sync')
  async syncReportes(@Body() body: any) {
    const { collectorId, reportes } = body;
    let insertados = 0;
    let duplicados = 0;
    const invalidos = [];

    for (const rep of reportes) {
      try {
        // Validar coordenadas (Regla del contrato)
        if (rep.lat < -90 || rep.lat > 90 || rep.lng < -180 || rep.lng > 180) {
          invalidos.push({ id: rep.id, error: "Coordenadas fuera de rango" });
          continue;
        }

        // Idempotencia: Si el UUID ya existe, se ignora (cuenta como duplicado)
        const existe = await this.prisma.reporte.findUnique({ where: { id: rep.id } });
        if (existe) {
          duplicados++;
          continue;
        }

        // Insertar usando PostGIS (La magia espacial del proyecto)
        await this.prisma.$executeRaw`
          INSERT INTO "Reporte" (
            "id", "deviceId", "createdAt", "latitud", "longitud", "tipo", 
            "heridos", "personasAtrapadas", "descripcion", "collectorId", "geom"
          ) VALUES (
            ${rep.id}, ${rep.deviceId}, ${new Date(rep.createdAt)}, 
            ${rep.lat}, ${rep.lng}, ${rep.tipo}, ${rep.heridos}, 
            ${rep.personasAtrapadas}, ${rep.descripcion}, ${collectorId},
            ST_SetSRID(ST_MakePoint(${rep.lng}, ${rep.lat}), 4326)
          )
        `;
        insertados++;
      } catch (error) {
        invalidos.push({ id: rep.id, error: error.message });
      }
    }
    
    return { insertados, duplicados, invalidos };
  }
}