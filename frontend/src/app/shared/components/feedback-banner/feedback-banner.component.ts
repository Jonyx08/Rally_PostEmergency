import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FeedbackData } from '../../../core/models/reporte.model';

@Component({
  selector: 'app-feedback-banner',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './feedback-banner.component.html',
  styleUrl: './feedback-banner.component.css',
})
export class FeedbackBannerComponent {
  @Input({ required: true }) data!: FeedbackData;
  @Output() close = new EventEmitter<void>();
}
