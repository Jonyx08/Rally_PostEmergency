import { Module } from '@nestjs/common';
import { TriajeModule } from '../triaje/triaje.module';
import { ReportesController } from './reportes.controller';
import { ReportesService } from './reportes.service';

@Module({
  imports: [TriajeModule],
  controllers: [ReportesController],
  providers: [ReportesService],
})
export class ReportesModule {}
