import { Component, effect, inject, signal, afterNextRender, Injector } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { RouterOutlet, RouterLink, Router, NavigationEnd } from '@angular/router';
import { filter, take } from 'rxjs';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AppUpdateService } from './core/services/app-update.service';
import { ConfirmDialogComponent } from './shared/components/confirm-dialog/confirm-dialog.component';
import { ContactDialogComponent } from './shared/components/contact-dialog/contact-dialog.component';
import { siteLinks } from './core/config/site-links';
import { version } from '../../package.json';
import { AuthService } from './core/services/auth.service';
import { ThemeService } from './core/services/theme.service';
import { ViewportService } from './core/services/viewport.service';
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
  LucideEllipsisVertical,
  LucideMail,
  LucideHeart,
} from '@lucide/angular';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    NgTemplateOutlet,
    MatToolbarModule,
    MatButtonModule,
    MatMenuModule,
    MatDividerModule,
    MatDialogModule,
    MatTooltipModule,
    LucideArrowLeft,
    LucideSun,
    LucideMoon,
    LucideUser,
    LucideChevronDown,
    LucideUsers,
    LucideIdCard,
    LucideGavel,
    LucideLogOut,
    LucideEllipsisVertical,
    LucideMail,
    LucideHeart,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly siteLinks = siteLinks;
  readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly viewport = inject(ViewportService);
  private lastPath = "";
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);
  readonly appUpdate = inject(AppUpdateService);
  readonly version = version;
  private updateDialogOpen = false;

  // 判斷是否處於角色內頁（非角色列表、非登入註冊頁面）
  readonly showBack = signal(false);

  protected skipToContent(event: Event): void {
    event.preventDefault();
    document.getElementById('main-content')?.focus();
  }

  constructor() {
    this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe((event) => {
        const url = event.urlAfterRedirects;
        const path = url.split(/[?#]/)[0];
        if (path !== this.lastPath) {
          this.lastPath = path;
          afterNextRender(() => {
            document.getElementById('main-content')?.focus({ preventScroll: true });
          }, { injector: this.injector });
        }
        // 只要不是 /characters 列表首頁，處於角色詳情/新建/編輯時就顯示返回
        const isDetailPage =
          url.startsWith('/characters/') ||
          url.includes('/adventures') ||
          url.includes('/inventory');
        this.showBack.set(isDetailPage);
      });
    effect(() => {
      if (this.appUpdate.needsReload()) this.showUpdateNotice();
    });
  }

  async checkForUpdates(): Promise<void> {
    const alreadyReady = this.appUpdate.needsReload();
    await this.appUpdate.checkForUpdates();
    if (this.appUpdate.needsReload()) {
      if (alreadyReady) this.showUpdateNotice();
    } else {
      this.snackBar.open(this.appUpdate.message(), '關閉', {
        duration: 3000, verticalPosition: 'top', horizontalPosition: 'right',
      });
    }
  }

  private showUpdateNotice(): void {
    const message = this.appUpdate.reloadRequired()
      ? '目前版本需要重新載入，請先儲存資料。'
      : '新版已準備好，可重新整理以更新。';
    this.snackBar.open(message, '重新整理', {
      duration: 8000, verticalPosition: 'top', horizontalPosition: 'right',
    }).onAction().pipe(take(1)).subscribe(() => this.confirmUpdate());
  }

  confirmUpdate(): void {
    if (!this.appUpdate.needsReload() || this.updateDialogOpen) return;
    this.updateDialogOpen = true;
    this.dialog.open(ConfirmDialogComponent, {
      width: '480px',
      maxWidth: '92vw',
      autoFocus: 'button',
      data: {
        title: '確認重新整理',
        message: '重新整理會清除尚未儲存的輸入。請先儲存正在編輯的資料，再重新整理。',
        confirmText: '重新整理',
        cancelText: '繼續使用',
      },
    }).afterClosed().pipe(take(1)).subscribe(confirmed => {
      this.updateDialogOpen = false;
      if (confirmed === true) this.appUpdate.reload();
    });
  }

  goBack(): void {
    this.router.navigate(['/characters']);
  }

  openContactDialog(): void {
    const trigger = document.querySelector<HTMLButtonElement>(
      this.authService.isAuthenticated() ? '.user-pill-btn' : '.more-menu-btn',
    );
    this.dialog.open(ContactDialogComponent, {
      width: '480px', maxWidth: '92vw', restoreFocus: false, ariaLabel: '聯絡我',
    }).afterClosed().pipe(take(1)).subscribe(() => trigger?.focus());
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
