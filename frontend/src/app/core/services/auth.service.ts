import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { defer, EMPTY, Observable, Subject, takeUntil, tap } from 'rxjs';
import { AuthResponse, LoginCredentials, OAuthLoginRequest, RegisterCredentials, User } from '../models/auth.model';
import { environment } from '../../../environments/environment';
import { CharacterService } from './character.service';
import { AdventureService } from './adventure.service';
import { InventoryService } from './inventory.service';
import { LocalStore } from './local-store.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly local = inject(LocalStore);
  private readonly router = inject(Router);
  private readonly characterService = inject(CharacterService);
  private readonly adventureService = inject(AdventureService);
  private readonly inventoryService = inject(InventoryService);
  private readonly API_URL = `${environment.apiUrl}/auth`;

  private readonly TOKEN_KEY = 'dnd_auth_token';
  private readonly USER_KEY = 'dnd_auth_user';
  private readonly CHECK_KEY = 'dnd_auth_check';
  private readonly CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
  private readonly sessionChanged = new Subject<void>();

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
    this.local.setOwner(this.currentUser()?.id ?? null);
    window.addEventListener('storage', event => {
      if (event.key !== this.TOKEN_KEY && event.key !== this.USER_KEY) return;
      this.sessionChanged.next();
      this.token.set(this.getStoredToken());
      this.currentUser.set(this.getStoredUser());
      this.local.setOwner(this.currentUser()?.id ?? null);
      this.clearAllCaches();
    });
    // 等服務建構完成，避免 HTTP interceptor 注入 AuthService 時產生循環。
    queueMicrotask(() => this.checkSessionIfNeeded());
  }

  checkSessionIfNeeded(): void {
    if (!this.token()) return;
    if (this.isTokenExpired()) {
      this.logout(false);
      return;
    }

    const user = this.currentUser();
    if (user && this.hasRecentCheck(user.id)) return;

    // 記錄嘗試，避免網路暫時失敗後每次重開都重送；沒有帳號資料仍可重試恢復。
    if (user) this.recordCheck(user.id);
    this.fetchCurrentUser().subscribe({
      error: (err) => {
        if (err?.status === 401) this.logout(false);
      },
    });
  }

  private hasRecentCheck(userId: string): boolean {
    try {
      const check = JSON.parse(localStorage.getItem(this.CHECK_KEY) ?? 'null');
      const age = Date.now() - check?.checkedAt;
      return check?.userId === userId && Number.isFinite(check.checkedAt)
        && age >= 0 && age < this.CHECK_INTERVAL_MS;
    } catch {
      return false;
    }
  }

  private recordCheck(userId: string): void {
    localStorage.setItem(this.CHECK_KEY, JSON.stringify({ userId, checkedAt: Date.now() }));
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
    const token = this.token();
    return defer(() => token && token === this.token()
      ? this.http.get<User>(`${this.API_URL}/me`) : EMPTY).pipe(
      takeUntil(this.sessionChanged),
      tap((user) => {
        if (this.local.owner() !== user.id) {
          const previous = this.local.owner();
          if (previous) this.local.invalidate(undefined, previous, false);
          this.local.setOwner(user.id);
        }
        this.currentUser.set(user);
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
        this.recordCheck(user.id);
      })
    );
  }

  updateProfile(displayName: string, avatarUrl?: string | null): Observable<User> {
    const token = this.token();
    return defer(() => token && token === this.token()
      ? this.http.put<User>(`${this.API_URL}/me`, { displayName, avatarUrl }) : EMPTY).pipe(
      takeUntil(this.sessionChanged),
      tap((user) => {
        this.currentUser.set(user);
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      })
    );
  }

  logout(redirect = true): void {
    this.local.invalidate(undefined, this.currentUser()?.id ?? null, false);
    this.local.setOwner(null);
    this.sessionChanged.next();
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.CHECK_KEY);
    this.token.set(null);
    this.currentUser.set(null);
    this.clearAllCaches();

    if (redirect) {
      this.router.navigate(['/login']);
    }
  }

  private handleAuthSuccess(res: AuthResponse): void {
    const oldOwner = this.currentUser()?.id;
    if (oldOwner && oldOwner !== res.user.id) this.local.invalidate(undefined, oldOwner, false);
    this.local.setOwner(res.user.id);
    this.sessionChanged.next();
    localStorage.setItem(this.TOKEN_KEY, res.token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(res.user));
    this.token.set(res.token);
    this.currentUser.set(res.user);
    this.recordCheck(res.user.id);
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
