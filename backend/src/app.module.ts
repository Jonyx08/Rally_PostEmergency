import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma.service';
import { ReportesController } from './reportes.controller';

@Module({
  imports: [],
  controllers: [AppController, ReportesController],
  providers: [AppService, PrismaService],
})
export class AppModule {}