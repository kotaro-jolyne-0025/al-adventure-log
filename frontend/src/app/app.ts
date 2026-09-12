import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from './core/services/auth.service';
import { ThemeService } from './core/services/theme.service';
import { EditProfileDialogComponent } from './features/auth/edit-profile-dialog/edit-profile-dialog.component';

import { LucideDices } from '@lucide/angular';

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
    MatTooltipModule,
    LucideDices,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);

  // 判斷是否處於角色內頁（非角色列表、非登入註冊頁面）
  readonly showBack = signal(false);

  constructor() {
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe((event) => {
      const url = event.urlAfterRedirects;
      // 只要不是 /characters 列表首頁，處於角色詳情/新建/編輯時就顯示返回
      const isDetailPage = url.startsWith('/characters/') || url.includes('/adventures') || url.includes('/inventory');
      this.showBack.set(isDetailPage);
    });
  }

  goBack(): void {
    this.router.navigate(['/characters']);
  }

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
