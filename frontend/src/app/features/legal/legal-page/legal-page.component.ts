import { Component, inject } from '@angular/core';

import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { LucideExternalLink, LucideArrowLeft } from '@lucide/angular';

@Component({
  selector: 'app-legal-page',
  standalone: true,
  imports: [MatButtonModule, LucideExternalLink, LucideArrowLeft],
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
