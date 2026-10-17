import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'node:path';
import { DemoModule } from './demo/demo.module';
import { HealthModule } from './health/health.module';
import { IncidentesModule } from './incidentes/incidentes.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportesModule } from './reportes/reportes.module';
import { ZonasModule } from './zonas/zonas.module';

@Module({
  imports: [
    // Tablero del COE (página estática en backend/public), servido en "/".
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      exclude: ['/api/{*rest}'],
    }),
    PrismaModule,
    ReportesModule,
    IncidentesModule,
    ZonasModule,
    HealthModule,
    DemoModule,
  ],
})
export class AppModule {}
