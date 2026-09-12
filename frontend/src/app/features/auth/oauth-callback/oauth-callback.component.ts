import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-oauth-callback',
  standalone: true,
  imports: [CommonModule, RouterLink, MatProgressSpinnerModule, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    <div class="callback-container">
      <mat-card class="callback-card">
        <div *ngIf="isLoading()" class="loading-state">
          <mat-spinner diameter="48"></mat-spinner>
          <h3>正在進行第三方帳號登入...</h3>
          <p>請稍候，系統正在為您同步資料</p>
        </div>

        <div *ngIf="errorMessage()" class="error-state">
          <mat-icon color="warn" class="error-icon">error</mat-icon>
          <h3>第三方登入失敗</h3>
          <p>{{ errorMessage() }}</p>
          <button mat-raised-button color="primary" routerLink="/login">返回登入頁</button>
        </div>
      </mat-card>
    </div>
  `,
  styles: [`
    .callback-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: calc(100vh - 120px);
      padding: 1.5rem;
    }
    .callback-card {
      width: 100%;
      max-width: 420px;
      padding: 2.5rem 1.5rem;
      border-radius: 16px;
      text-align: center;
    }
    .loading-state, .error-state {
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
  `],
})
export class OAuthCallbackComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);

  readonly isLoading = signal(true);
  readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    const providerParam = (this.route.snapshot.paramMap.get('provider') || '').toUpperCase();
    const provider = providerParam === 'GOOGLE' || providerParam === 'DISCORD' ? providerParam : null;

    if (!provider) {
      this.handleError('不支援的第三方認證來源');
      return;
    }

    // 1. 檢查 Query Params 中的 code
    const queryParams = this.route.snapshot.queryParams;
    let tokenOrCode = queryParams['code'];

    // 2. 檢查 Hash Fragments (Google OAuth implicit flow #id_token=... 或 access_token=...)
    if (!tokenOrCode && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      tokenOrCode = hashParams.get('id_token') || hashParams.get('access_token');
    }

    if (!tokenOrCode) {
      this.handleError('未接收到第三方授權憑證 (Code / Token)');
      return;
    }

    const redirectUri = window.location.origin + window.location.pathname;

    this.authService.loginOAuth({
      provider,
      tokenOrCode,
      redirectUri,
    }).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.snackBar.open(`登入成功，歡迎 ${res.user.displayName}！`, '關閉', { duration: 3000 });
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
