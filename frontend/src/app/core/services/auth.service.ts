import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { defer, EMPTY, finalize, fromEvent, merge, Observable, Subject, takeUntil, tap, throttleTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthResponse, LoginCredentials, OAuthLoginRequest, OAuthLoginResponse, RegisterCredentials, User } from '../models/auth.model';
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
  private renewing = false;
  private nextRenewAt = 0;

  // Signals
  readonly token = signal<string | null>(this.getStoredToken());
  readonly currentUser = signal<User | null>(this.getStoredUser());
  readonly isAuthenticated = computed(() => !!this.token() && !!this.currentUser());

  /**
   * 解析 JWT payload 判斷 token 是否已過期。
   * 採用 30 秒 buffer 避免在邊界時刻因時鐘誤差導致請求失敗。
   */
  isTokenExpired(): boolean {
    return Date.now() >= this.expiresAt(this.token()) - 30_000;
  }

  private tokenClaims(value: string | null): {
    sub?: string; exp?: number; iat?: number; sessionId?: string; tokenVersion?: number;
  } | null {
    if (!value) return null;
    try {
      // JWT 使用 base64url 編碼，需先轉換為標準 base64 供 atob() 解碼
      const base64Url = value.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      // 處理 UTF-8 多位元組字元（如中文 displayName）
      const jsonPayload = decodeURIComponent(
        atob(base64).split('').map(c =>
          '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        ).join('')
      );
      return JSON.parse(jsonPayload);
    } catch {
      return null;
    }
  }

  private expiresAt(value: string | null): number {
    const expiry = this.tokenClaims(value)?.exp;
    return typeof expiry === 'number' && Number.isFinite(expiry) ? expiry * 1000 : 0;
  }

  private sameSession(first: string | null, second: string | null): boolean {
    if (!first || !second) return false;
    if (first === second) return true;
    const a = this.tokenClaims(first);
    const b = this.tokenClaims(second);
    return !!a?.sub && a.sub === b?.sub && a.sessionId === b?.sessionId
      && (a.tokenVersion ?? 0) === (b?.tokenVersion ?? 0);
  }

  isCurrentSession(token: string | null): boolean {
    return this.sameSession(token, this.token()) && this.sameSession(token, this.getStoredToken());
  }

  renewOnActivity(): void {
    const token = this.token();
    const issuedAt = this.tokenClaims(token)?.iat ?? 0;
    const now = Date.now();
    if (document.visibilityState !== 'visible' || !navigator.onLine || this.renewing
      || !token || this.isTokenExpired() || now - issuedAt * 1000 < 10 * 60_000
      || now < this.nextRenewAt) return;
    this.nextRenewAt = now + 60_000;
    this.renewing = true;
    this.http.post<{ token: string }>(`${this.API_URL}/renew`, {}).pipe(
      takeUntil(this.sessionChanged),
      finalize(() => this.renewing = false),
    ).subscribe({
      next: result => {
        const stored = this.getStoredToken();
        if (!this.isCurrentSession(token) || !this.sameSession(token, stored)
          || !this.sameSession(token, result.token)) return;
        const current = this.expiresAt(stored) > this.expiresAt(this.token()) ? stored : this.token();
        const next = this.expiresAt(result.token) > this.expiresAt(current) ? result.token : current;
        localStorage.setItem(this.TOKEN_KEY, next!);
        this.token.set(next);
        this.nextRenewAt = Date.now() + 10 * 60_000;
      },
      // The interceptor handles 401; transient failures keep the current session.
      error: () => {},
    });
  }

  constructor() {
    this.local.setOwner(this.currentUser()?.id ?? null);
    fromEvent<StorageEvent>(window, 'storage').pipe(takeUntilDestroyed()).subscribe(event => {
      if (event.key !== this.TOKEN_KEY && event.key !== this.USER_KEY) return;
      const stored = this.getStoredToken();
      if (event.key === this.TOKEN_KEY && this.isCurrentSession(stored)) {
        if (this.expiresAt(stored) < this.expiresAt(this.token())) {
          localStorage.setItem(this.TOKEN_KEY, this.token()!);
        } else {
          if (this.expiresAt(stored) > this.expiresAt(this.token())) this.nextRenewAt = Date.now() + 10 * 60_000;
          this.token.set(stored);
        }
        return;
      }
      this.sessionChanged.next();
      this.token.set(this.getStoredToken());
      this.currentUser.set(this.getStoredUser());
      this.local.setOwner(this.currentUser()?.id ?? null);
      this.clearAllCaches();
    });
    merge(...['pointerdown', 'keydown', 'input', 'scroll'].map(name =>
      fromEvent(window, name, { capture: true, passive: true }),
    )).pipe(throttleTime(1000), takeUntilDestroyed()).subscribe(() => this.renewOnActivity());
    // 等服務建構完成，避免 HTTP interceptor 注入 AuthService 時產生循環。
    queueMicrotask(() => this.checkSessionIfNeeded());
  }

  checkSessionIfNeeded(): void {
    const token = this.token();
    if (!token) return;
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
        if (err?.status === 401 && this.isCurrentSession(token)) this.logout(false);
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

  loginOAuth(request: OAuthLoginRequest): Observable<OAuthLoginResponse> {
    return this.http.post<OAuthLoginResponse>(`${this.API_URL}/oauth`, request).pipe(
      tap((res) => { if (!res.registrationRequired) this.handleAuthSuccess(res); })
    );
  }

  registerOAuth(registrationToken: string, displayName: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API_URL}/oauth/register`, { registrationToken, displayName }).pipe(
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
    return defer(() => this.isCurrentSession(token)
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
    return defer(() => this.isCurrentSession(token)
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
    this.nextRenewAt = 0;
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
    this.nextRenewAt = 0;
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
