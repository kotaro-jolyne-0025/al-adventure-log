import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import {
  LucideExternalLink,
  LucideArrowLeft,
} from '@lucide/angular';

@Component({
  selector: 'app-legal-page',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDividerModule,
    LucideExternalLink,
    LucideArrowLeft,
  ],
  templateUrl: './legal-page.component.html',
  styleUrl: './legal-page.component.scss',
})
export class LegalPageComponent {
  private readonly router = inject(Router);

  goBack(): void {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.router.navigate(['/']);
    }
  }
}
