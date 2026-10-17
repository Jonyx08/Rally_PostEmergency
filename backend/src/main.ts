import 'dotenv/config';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

export async function crearApp() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  app.useBodyParser('json', { limit: '10mb' });
  app.setGlobalPrefix('api');

  const origenes = (process.env.CORS_ORIGINS ?? 'http://localhost:4200')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({ origin: origenes });

  const doc = new DocumentBuilder()
    .setTitle('API de Triaje Post-Emergencia')
    .setDescription('Sincronización de reportes, clustering espacial y priorización de incidentes')
    .setVersion('0.1.0')
    .build();
  SwaggerModule.setup('api/docs', app, () => SwaggerModule.createDocument(app, doc));

  return app;
}

async function bootstrap() {
  const app = await crearApp();
  const puerto = Number(process.env.PORT ?? 3000);
  await app.listen(puerto);
  const log = new Logger('Bootstrap');
  log.log(`API lista en http://localhost:${puerto}/api`);
  log.log(`Swagger en http://localhost:${puerto}/api/docs`);
  log.log(`Tablero del COE en http://localhost:${puerto}/`);
}

if (require.main === module) {
  void bootstrap();
}
