import { Module } from '@nestjs/common';
import { TriajeService } from './triaje.service';

@Module({
  providers: [TriajeService],
  exports: [TriajeService],
})
export class TriajeModule {}
