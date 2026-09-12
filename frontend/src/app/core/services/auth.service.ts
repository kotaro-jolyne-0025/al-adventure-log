import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { AuthResponse, LoginCredentials, OAuthLoginRequest, RegisterCredentials, User } from '../models/auth.model';
import { environment } from '../../../environments/environment';
import { CharacterService } from './character.service';
import { AdventureService } from './adventure.service';
import { InventoryService } from './inventory.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly characterService = inject(CharacterService);
  private readonly adventureService = inject(AdventureService);
  private readonly inventoryService = inject(InventoryService);
  private readonly API_URL = `${environment.apiUrl}/auth`;

  private readonly TOKEN_KEY = 'dnd_auth_token';
  private readonly USER_KEY = 'dnd_auth_user';

  // Signals
  readonly token = signal<string | null>(this.getStoredToken());
  readonly currentUser = signal<User | null>(this.getStoredUser());
  readonly isAuthenticated = computed(() => !!this.token() && !!this.currentUser());

  /**
   * 解析 JWT payload 判斷 token 是否已過期。
   * 採用 30 秒 buffer 避免在邊界時刻因時鐘誤差導致請求失敗。
   */
  isTokenExpired(): boolean {
    const t = this.token();
    if (!t) return true;

    try {
      // JWT 使用 base64url 編碼，需先轉換為標準 base64 供 atob() 解碼
      const base64Url = t.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      // 處理 UTF-8 多位元組字元（如中文 displayName）
      const jsonPayload = decodeURIComponent(
        atob(base64).split('').map(c =>
          '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        ).join('')
      );
      const payload = JSON.parse(jsonPayload);
      if (!payload.exp) return false; // 沒有 exp claim 則視為不過期
      const bufferSeconds = 30;
      return Date.now() >= (payload.exp - bufferSeconds) * 1000;
    } catch {
      return true; // 解析失敗視為過期
    }
  }

  constructor() {
    // 啟動時驗證 token
    if (this.token()) {
      this.fetchCurrentUser().subscribe({
        error: (err) => {
          // 只有明確回傳 401 (Token 失效或未授權) 時才清空登入狀態，避免因網路短暫不穩或伺服器啟動中誤登出
          if (err?.status === 401) {
            this.logout(false);
          }
        },
      });
    }
  }

  register(credentials: RegisterCredentials): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/register`, credentials).pipe(
      tap((res) => this.handleAuthSuccess(res))
    );
  }

  login(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/login`, credentials).pipe(
      tap((res) => this.handleAuthSuccess(res))
    );
  }

  loginOAuth(request: OAuthLoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/oauth`, request).pipe(
      tap((res) => this.handleAuthSuccess(res))
    );
  }

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API_URL}/forgot-password`, { email });
  }

  resetPassword(token: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API_URL}/reset-password`, { token, newPassword });
  }

  verifyResetToken(token: string): Observable<{ valid: boolean }> {
    return this.http.get<{ valid: boolean }>(`${this.API_URL}/verify-reset-token`, {
      params: { token },
    });
  }

  fetchCurrentUser(): Observable<User> {
    return this.http.get<User>(`${this.API_URL}/me`).pipe(
      tap((user) => {
        this.currentUser.set(user);
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      })
    );
  }

  updateProfile(displayName: string, avatarUrl?: string | null): Observable<User> {
    return this.http.put<User>(`${this.API_URL}/me`, { displayName, avatarUrl }).pipe(
      tap((user) => {
        this.currentUser.set(user);
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      })
    );
  }

  logout(redirect = true): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.token.set(null);
    this.currentUser.set(null);
    this.clearAllCaches();

    if (redirect) {
      this.router.navigate(['/login']);
    }
  }

  private handleAuthSuccess(res: AuthResponse): void {
    localStorage.setItem(this.TOKEN_KEY, res.token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(res.user));
    this.token.set(res.token);
    this.currentUser.set(res.user);
    this.clearAllCaches();
  }

  private clearAllCaches(): void {
    this.characterService.clearCache();
    this.adventureService.clearCache();
    this.inventoryService.clearCache();
  }

  private getStoredToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  private getStoredUser(): User | null {
    const raw = localStorage.getItem(this.USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}
