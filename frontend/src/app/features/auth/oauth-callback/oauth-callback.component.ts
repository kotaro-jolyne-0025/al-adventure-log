import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { AuthResponse } from '../../../core/models/auth.model';
import { OAuthRegisterDialogComponent } from '../oauth-register-dialog/oauth-register-dialog.component';

import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';

import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth.service';
import { LucideCircleAlert } from '@lucide/angular';

@Component({
  selector: 'app-oauth-callback',
  standalone: true,
  imports: [
    RouterLink,
    MatProgressSpinner,
    MatCardModule,
    MatButtonModule,
    LucideCircleAlert,
  ],
  template: `
    <div class="callback-container">
      <mat-card class="callback-card">
        @if (isLoading()) {
          <div class="loading-state">
            <mat-spinner diameter="48"></mat-spinner>
            <h3>正在進行第三方帳號登入...</h3>
            <p>請稍候，系統正在為您同步資料</p>
          </div>
        }

        @if (errorMessage()) {
          <div class="error-state">
            <svg lucideCircleAlert [size]="20" color="warn" class="error-icon"></svg>
            <h3>第三方登入失敗</h3>
            <p>{{ errorMessage() }}</p>
            <button mat-raised-button color="primary" routerLink="/login">返回登入頁</button>
          </div>
        }
      </mat-card>
    </div>
  `,
  styles: [
    `
      .callback-container {
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: calc(100dvh - 120px);
        padding: 1.5rem;
      }
      .callback-card {
        width: 100%;
        max-width: 420px;
        padding: 2.5rem 1.5rem;
        border-radius: 16px;
        text-align: center;
      }
      .loading-state,
      .error-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 1rem;
      }
      .error-icon {
        font-size: 3rem;
        width: 3rem;
        height: 3rem;
      }
    `,
  ],
})
export class OAuthCallbackComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    const provider = (this.route.snapshot.paramMap.get('provider') || '').toUpperCase();

    // Google GIS returns an ID token to the login page, never an authorization code here.
    if (provider !== 'DISCORD') {
      this.handleError('不支援的第三方認證來源');
      return;
    }

    // 1. 檢查 Query Params 中的 code 與 state
    const queryParams = this.route.snapshot.queryParams;
    const tokenOrCode = queryParams['code'];

    // 驗證 Discord OAuth 的 state 參數 (CSRF 防護)
    const expectedState = sessionStorage.getItem('oauth_state_discord');
    const receivedState = queryParams['state'];
    sessionStorage.removeItem('oauth_state_discord');

    if (!expectedState || receivedState !== expectedState) {
      this.handleError('登入安全性校驗失敗 (CSRF State 不符)，請重新登入');
      return;
    }

    if (!tokenOrCode) {
      this.handleError('未接收到第三方授權碼 (Authorization Code)');
      return;
    }

    const redirectUri = window.location.origin + window.location.pathname;

    this.authService
      .loginOAuth({
        provider,
        tokenOrCode,
        redirectUri,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          if (res.registrationRequired) {
            this.dialog.open(OAuthRegisterDialogComponent, {
              width: '440px', maxWidth: 'calc(100vw - 32px)',
              data: { registrationToken: res.registrationToken },
            }).afterClosed().pipe(takeUntilDestroyed(this.destroyRef)).subscribe((registered: AuthResponse | undefined) => {
              this.isLoading.set(false);
              if (registered) this.snackBar.open(`註冊成功，歡迎 ${registered.user.displayName}！`, '關閉', { duration: 3000 });
              this.router.navigate([registered ? '/characters' : '/login']);
            });
            return;
          }
          this.isLoading.set(false);
          this.snackBar.open(`登入成功，歡迎 ${res.user.displayName}！`, '關閉', {
            duration: 3000,
          });
          this.router.navigate(['/characters']);
        },
        error: (err) => {
          const msg = err.error?.message || '第三方登入處理失敗';
          this.handleError(msg);
        },
      });
  }

  private handleError(msg: string): void {
    this.isLoading.set(false);
    this.errorMessage.set(msg);
    this.snackBar.open(msg, '關閉', { duration: 4000 });
  }
}
