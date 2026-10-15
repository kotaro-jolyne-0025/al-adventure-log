import { Component, inject } from '@angular/core';

import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { ContactDialogComponent } from '../../shared/components/contact-dialog/contact-dialog.component';
import { siteLinks } from '../../core/config/site-links';
import { AuthService } from '../../core/services/auth.service';
import { version } from '../../../../package.json';
import { LucideMail, LucideHeart } from '@lucide/angular';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, MatCardModule, MatButtonModule, LucideMail, LucideHeart],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent {
  readonly siteLinks = siteLinks;
  private readonly dialog = inject(MatDialog);
  readonly version = version;
  readonly authService = inject(AuthService);

  openContactDialog(): void {
    this.dialog.open(ContactDialogComponent, { width: '480px', maxWidth: '92vw', ariaLabel: '聯絡我' });
  }
}
