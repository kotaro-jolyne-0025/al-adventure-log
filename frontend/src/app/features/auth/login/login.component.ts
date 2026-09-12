import { Component, AfterViewInit, inject, signal, NgZone, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth.service';

import { environment } from '../../../../environments/environment';

declare const google: any;

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatDividerModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent implements AfterViewInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);
  private readonly ngZone = inject(NgZone);

  readonly hidePassword = signal(true);
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly loginForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  private get returnUrl(): string {
    return this.route.snapshot.queryParams['returnUrl'] || '/characters';
  }

  ngAfterViewInit(): void {
    this.initGoogleSignIn();
  }

  private initGoogleSignIn(): void {
    if (typeof window === 'undefined') return;

    let retryCount = 0;
    const maxRetries = 30;

    const tryInit = () => {
      if (typeof google !== 'undefined' && google?.accounts?.id) {
        google.accounts.id.initialize({
          client_id: environment.googleClientId,
          callback: (response: any) => {
            this.ngZone.run(() => {
              this.handleGoogleCredentialResponse(response);
            });
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        const container = document.getElementById('google-btn-container');
        if (container) {
          const containerWidth = container.offsetWidth > 0 ? container.offsetWidth : 390;
          google.accounts.id.renderButton(container, {
            theme: 'outline',
            size: 'large',
            type: 'standard',
            shape: 'rectangular',
            text: 'signin_with',
            logo_alignment: 'center',
            width: containerWidth,
          });
        }
      } else if (retryCount < maxRetries) {
        retryCount++;
        setTimeout(tryInit, 150);
      }
    };

    tryInit();
  }

  private handleGoogleCredentialResponse(response: { credential: string }): void {
    if (!response?.credential) {
      this.errorMessage.set('Google 登入憑證無效');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authService.loginOAuth({
      provider: 'GOOGLE',
      tokenOrCode: response.credential,
      redirectUri: window.location.origin,
    }).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.snackBar.open(`歡迎回來，${res.user.displayName}！`, '關閉', { duration: 3000 });
        this.router.navigateByUrl(this.returnUrl);
      },
      error: (err) => {
        this.isLoading.set(false);
        const msg = err.error?.message || 'Google 登入驗證失敗';
        this.errorMessage.set(msg);
        this.snackBar.open(msg, '關閉', { duration: 4000 });
      },
    });
  }

  onSubmit(): void {
    if (this.loginForm.invalid || this.isLoading()) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authService.login(this.loginForm.value).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.snackBar.open(`歡迎回來，${res.user.displayName}！`, '關閉', { duration: 3000 });
        this.router.navigateByUrl(this.returnUrl);
      },
      error: (err) => {
        this.isLoading.set(false);
        const msg = err.error?.message || '登入失敗，請檢查帳號密碼';
        this.errorMessage.set(msg);
        this.snackBar.open(msg, '關閉', { duration: 4000 });
      },
    });
  }

  loginWithDiscord(): void {
    const clientId = environment.discordClientId;
    const redirectUri = encodeURIComponent(`${window.location.origin}/auth/callback/discord`);
    const stateArray = new Uint8Array(24);
    crypto.getRandomValues(stateArray);
    const state = Array.from(stateArray, b => b.toString(16).padStart(2, '0')).join('');
    sessionStorage.setItem('oauth_state_discord', state);
    const discordAuthUrl = `https://discord.com/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify%20email&state=${state}&prompt=consent`;

    window.location.href = discordAuthUrl;
  }
}
