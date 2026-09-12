import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AuthService } from './core/services/auth.service';
import { EditProfileDialogComponent } from './features/auth/edit-profile-dialog/edit-profile-dialog.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDividerModule,
    MatDialogModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);

  openEditProfileDialog(): void {
    const currentUser = this.authService.currentUser();
    if (!currentUser) return;

    this.dialog.open(EditProfileDialogComponent, {
      width: '400px',
      data: { user: currentUser },
    });
  }

  logout(): void {
    this.authService.logout(true);
  }
}
