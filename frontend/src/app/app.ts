import { Component, inject, signal } from '@angular/core';

import { RouterOutlet, RouterLink, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { SwUpdate } from '@angular/service-worker';
import { AuthService } from './core/services/auth.service';
import { ThemeService } from './core/services/theme.service';
import { EditProfileDialogComponent } from './features/auth/edit-profile-dialog/edit-profile-dialog.component';
import {
  LucideArrowLeft,
  LucideSun,
  LucideMoon,
  LucideUser,
  LucideChevronDown,
  LucideUsers,
  LucideIdCard,
  LucideGavel,
  LucideLogOut,
} from '@lucide/angular';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    MatToolbarModule,
    MatButtonModule,
    MatMenuModule,
    MatDividerModule,
    MatDialogModule,
    MatTooltipModule,
    MatSnackBarModule,
    LucideArrowLeft,
    LucideSun,
    LucideMoon,
    LucideUser,
    LucideChevronDown,
    LucideUsers,
    LucideIdCard,
    LucideGavel,
    LucideLogOut,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly swUpdate = inject(SwUpdate);
  private readonly snackBar = inject(MatSnackBar);

  // 判斷是否處於角色內頁（非角色列表、非登入註冊頁面）
  readonly showBack = signal(false);

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((event) => {
        const url = event.urlAfterRedirects;
        // 只要不是 /characters 列表首頁，處於角色詳情/新建/編輯時就顯示返回
        const isDetailPage =
          url.startsWith('/characters/') ||
          url.includes('/adventures') ||
          url.includes('/inventory');
        this.showBack.set(isDetailPage);
      });

    // 監聽 PWA Service Worker 新版本通知
    if (this.swUpdate.isEnabled) {
      this.swUpdate.versionUpdates.pipe(
        filter(evt => evt.type === 'VERSION_READY')
      ).subscribe(() => {
        const snackRef = this.snackBar.open('發現新版本！是否立即重新整理以載入最新內容？', '重新整理', {
          duration: 0, // 不自動關閉
          horizontalPosition: 'right',
          verticalPosition: 'bottom'
        });
        
        snackRef.onAction().subscribe(() => {
          document.location.reload();
        });
      });
    }
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
