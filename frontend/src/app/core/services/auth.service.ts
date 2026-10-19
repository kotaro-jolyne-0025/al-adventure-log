import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, defaultIfEmpty, defer, EMPTY, finalize, firstValueFrom, from, fromEvent, map, merge, Observable, of, shareReplay, Subject, takeUntil, tap, throttleTime } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthResponse, AuthSession, AuthStateResponse, LoginCredentials, OAuthLoginRequest, OAuthLoginResponse, RegisterCredentials, User } from '../models/auth.model';
import { environment } from '../../../environments/environment';
import { CharacterService } from './character.service';
import { AdventureService } from './adventure.service';
import { InventoryService } from './inventory.service';
import { LocalStore } from './local-store.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly local = inject(LocalStore);
  private readonly router = inject(Router);
  private readonly characterService = inject(CharacterService);
  private readonly adventureService = inject(AdventureService);
  private readonly inventoryService = inject(InventoryService);
  private readonly API_URL = `${environment.apiUrl}/auth`;
  private readonly USER_KEY = 'dnd_auth_user';
  private readonly SESSION_KEY = 'dnd_auth_session';
  private readonly CHECK_KEY = 'dnd_auth_check';
  private readonly LOGOUT_PENDING_KEY = 'dnd_auth_logout_pending';
  private readonly MIGRATION_KEY = 'dnd_auth_cookie_migration_v1';
  private readonly MUTATION_KEY = 'dnd_auth_cookie_inflight';
  private readonly CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
  private readonly sessionChanged = new Subject<void>();
  private renewing = false;
  private nextRenewAt = 0;
  private restoreRequest: Observable<boolean> | null = null;

  readonly session = signal<AuthSession | null>(this.getStoredSession());
  readonly currentUser = signal<User | null>(this.getStoredUser());
  readonly logoutPending = signal(!!localStorage.getItem(this.LOGOUT_PENDING_KEY));
  readonly lockUnsupported = signal(false);
  readonly isAuthenticated = computed(() => !!this.session() && !!this.currentUser());

  isTokenExpired(): boolean {
    const expiry = this.session()?.expiresAt;
    return !expiry || Date.now() >= Date.parse(expiry) - 30_000;
  }

  isCurrentSession(id: string | null): boolean {
    return !!id && id === this.session()?.id && id === this.getStoredSession()?.id;
  }

  renewOnActivity(): void {
    const session = this.session();
    const now = Date.now();
    if (document.visibilityState !== 'visible' || !navigator.onLine || this.renewing
      || !session || this.isTokenExpired() || now - Date.parse(session.issuedAt) < 10 * 60_000
      || now < this.nextRenewAt || localStorage.getItem(this.LOGOUT_PENDING_KEY)) return;
    this.nextRenewAt = now + 60_000;
    this.renewing = true;
    this.withAuthLock(() => defer(() => {
      const latest = this.getStoredSession();
      if (!this.isCurrentSession(session.id) || !latest || this.isTokenExpired()
        || Date.now() - Date.parse(latest.issuedAt) < 10 * 60_000 || localStorage.getItem(this.LOGOUT_PENDING_KEY)) return EMPTY;
      return this.http.post<{ session: AuthSession }>(`${this.API_URL}/renew`, {}, { headers: { 'X-Session-Id': session.id } });
    }).pipe(tap(result => {
        if (this.isCurrentSession(session.id)) {
          this.storeSession(result.session);
          this.nextRenewAt = Date.now() + 10 * 60_000;
        }
      }))).pipe(takeUntil(this.sessionChanged), finalize(() => this.renewing = false))
      .subscribe({
        next: () => {},
        error: () => {},
      });
  }

  constructor() {
    const previousOwner = this.currentUser()?.id ?? null;
    this.removeLegacyAuthOnce();
    if (localStorage.getItem(this.LOGOUT_PENDING_KEY)) this.clearLocalAuth(false);
    else if (previousOwner && !this.currentUser()) {
      this.local.invalidate(undefined, previousOwner, false);
      this.clearAllCaches();
    }
    this.local.setOwner(this.currentUser()?.id ?? null);
    fromEvent<StorageEvent>(window, 'storage').pipe(takeUntilDestroyed()).subscribe(event => {
      if (![this.SESSION_KEY, this.USER_KEY, this.LOGOUT_PENDING_KEY].includes(event.key ?? '')) return;
      if (event.key === this.LOGOUT_PENDING_KEY && event.newValue) {
        this.logoutPending.set(true);
        this.clearLocalAuth(false);
        return;
      }
      if (event.key === this.LOGOUT_PENDING_KEY) { this.logoutPending.set(false); return; }
      const nextSession = this.getStoredSession();
      const nextUser = this.getStoredUser();
      if (nextSession && nextSession.id === this.session()?.id && nextUser?.id === this.currentUser()?.id) {
        this.session.set(nextSession);
        this.currentUser.set(nextUser);
        return;
      }
      this.sessionChanged.next();
      this.session.set(nextSession);
      this.currentUser.set(nextUser);
      this.local.setOwner(nextUser?.id ?? null);
      this.clearAllCaches();
    });
    merge(...['pointerdown', 'keydown', 'input', 'scroll'].map(name =>
      fromEvent(window, name, { capture: true, passive: true }),
    )).pipe(throttleTime(1000), takeUntilDestroyed()).subscribe(() => this.renewOnActivity());
    fromEvent(window, 'online').pipe(takeUntilDestroyed()).subscribe(() => {
      if (localStorage.getItem(this.LOGOUT_PENDING_KEY)) this.finishPendingLogout();
      else this.checkSessionIfNeeded();
    });
    queueMicrotask(() => {
      void this.bootstrapCsrf();
      if (localStorage.getItem(this.LOGOUT_PENDING_KEY)) this.finishPendingLogout();
      else this.checkSessionIfNeeded();
    });
  }

  checkSessionIfNeeded(): void {
    if (localStorage.getItem(this.LOGOUT_PENDING_KEY)) return;
    if (localStorage.getItem(this.MUTATION_KEY)) { this.restoreSession().subscribe(); return; }
    const session = this.session();
    const user = this.currentUser();
    if (session && this.isTokenExpired()) {
      this.clearLocalAuth(true);
      return;
    }
    if (!session || !user) {
      this.restoreSession().subscribe();
      return;
    }
    if (this.hasRecentCheck(user.id)) return;
    if (user) this.recordCheck(user.id);
    this.fetchCurrentUser().subscribe({
      error: err => { if (err?.status === 401 && this.isCurrentSession(session?.id ?? null)) this.logout(false); },
    });
  }

  restoreSession(): Observable<boolean> {
    if (localStorage.getItem(this.LOGOUT_PENDING_KEY)) return of(false);
    const interrupted = !!localStorage.getItem(this.MUTATION_KEY);
    if (!interrupted && this.isAuthenticated() && !this.isTokenExpired()) return of(true);
    if (this.restoreRequest) return this.restoreRequest;
    const request = interrupted ? this.withAuthLock(() => this.fetchCurrentUser(), false) : this.fetchCurrentUser();
    this.restoreRequest = request.pipe(
      map(() => this.isAuthenticated() && !this.isTokenExpired()),
      defaultIfEmpty(false),
      catchError(() => of(false)),
      finalize(() => this.restoreRequest = null),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    return this.restoreRequest;
  }

  private hasRecentCheck(userId: string): boolean {
    try {
      const check = JSON.parse(localStorage.getItem(this.CHECK_KEY) ?? 'null');
      const age = Date.now() - check?.checkedAt;
      return check?.userId === userId && Number.isFinite(check.checkedAt) && age >= 0 && age < this.CHECK_INTERVAL_MS;
    } catch { return false; }
  }

  private recordCheck(userId: string): void {
    localStorage.setItem(this.CHECK_KEY, JSON.stringify({ userId, checkedAt: Date.now() }));
  }

  register(credentials: RegisterCredentials): Observable<AuthResponse> {
    return this.withAuthLock(() => this.http.post<AuthResponse>(`${this.API_URL}/register`, credentials)
      .pipe(tap(res => this.handleAuthSuccess(res))));
  }

  login(credentials: LoginCredentials): Observable<AuthResponse> {
    return this.withAuthLock(() => this.http.post<AuthResponse>(`${this.API_URL}/login`, credentials)
      .pipe(tap(res => this.handleAuthSuccess(res))));
  }

  loginOAuth(request: OAuthLoginRequest): Observable<OAuthLoginResponse> {
    return this.withAuthLock(() => this.http.post<OAuthLoginResponse>(`${this.API_URL}/oauth`, request)
      .pipe(tap(res => { if (!res.registrationRequired) this.handleAuthSuccess(res); })));
  }

  registerOAuth(registrationToken: string, displayName: string): Observable<AuthResponse> {
    return this.withAuthLock(() => this.http.post<AuthResponse>(`${this.API_URL}/oauth/register`, { registrationToken, displayName })
      .pipe(tap(res => this.handleAuthSuccess(res))));
  }

  forgotPassword(email: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API_URL}/forgot-password`, { email });
  }

  resetPassword(token: string, newPassword: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.API_URL}/reset-password`, { token, newPassword });
  }

  verifyResetToken(token: string): Observable<{ valid: boolean }> {
    return this.http.get<{ valid: boolean }>(`${this.API_URL}/verify-reset-token`, { params: { token } });
  }

  fetchCurrentUser(): Observable<User> {
    const session = this.session();
    return defer(() => localStorage.getItem(this.LOGOUT_PENDING_KEY) ? EMPTY
      : this.http.get<AuthStateResponse>(`${this.API_URL}/me`)).pipe(
      takeUntil(this.sessionChanged),
      tap(result => this.setAuthenticatedState(result.user, result.session)),
      tap(result => this.recordCheck(result.user.id)),
      map(result => result.user),
      catchError(error => {
        if (error?.status === 401 && this.isCurrentSession(session?.id ?? null)) this.logout(false);
        throw error;
      }),
    );
  }

  updateProfile(displayName: string, avatarUrl?: string | null): Observable<User> {
    const sessionId = this.session()?.id ?? null;
    if (!sessionId) return EMPTY;
    return this.http.put<User>(`${this.API_URL}/me`, { displayName, avatarUrl }, { headers: { 'X-Session-Id': sessionId } }).pipe(
      takeUntil(this.sessionChanged),
      tap(user => {
        if (!this.isCurrentSession(sessionId)) return;
        this.currentUser.set(user);
        localStorage.setItem(this.USER_KEY, JSON.stringify(user));
      }),
    );
  }

  logout(redirect = true): void {
    localStorage.setItem(this.LOGOUT_PENDING_KEY, crypto.randomUUID());
    this.logoutPending.set(true);
    this.clearLocalAuth(false);
    if (redirect) void this.router.navigate(['/login']);
    if (navigator.onLine) this.finishPendingLogout();
  }

  private finishPendingLogout(): void {
    const intent = localStorage.getItem(this.LOGOUT_PENDING_KEY);
    if (!intent || !navigator.onLine) return;
    this.withAuthLock(() => localStorage.getItem(this.LOGOUT_PENDING_KEY) === intent
      ? this.http.post<void>(`${this.API_URL}/logout`, {}) : EMPTY, false).subscribe({
      next: () => {
        if (localStorage.getItem(this.LOGOUT_PENDING_KEY) !== intent) return;
        localStorage.removeItem(this.LOGOUT_PENDING_KEY); this.logoutPending.set(false);
      },
      error: () => {},
    });
  }

  private withAuthLock<T>(work: () => Observable<T>, drainLogout = true): Observable<T> {
    return defer(() => {
      if (!navigator.locks?.request) {
        this.lockUnsupported.set(true);
        throw new Error('此瀏覽器不支援安全登入同步，請更新瀏覽器後再試。');
      }
      return from(navigator.locks.request('aladvlog-auth-cookie', async () => {
        localStorage.setItem(this.MUTATION_KEY, '1');
        try {
          await this.ensureCsrf();
          while (drainLogout && localStorage.getItem(this.LOGOUT_PENDING_KEY)) {
            const intent = localStorage.getItem(this.LOGOUT_PENDING_KEY);
            await firstValueFrom(this.http.post<void>(`${this.API_URL}/logout`, {}));
            if (localStorage.getItem(this.LOGOUT_PENDING_KEY) === intent) {
              localStorage.removeItem(this.LOGOUT_PENDING_KEY);
              this.logoutPending.set(false);
            }
          }
          return await firstValueFrom(work());
        } finally {
          // A closed tab cannot run this; the next startup then reconciles with the cookie.
          localStorage.removeItem(this.MUTATION_KEY);
        }
      }));
    });
  }

  private async ensureCsrf(): Promise<void> {
    const cookieName = environment.xsrfCookieName;
    if (document.cookie.split(';').some(item => item.trim().startsWith(`${cookieName}=`))) return;
    try {
      await firstValueFrom(this.http.get<void>(`${this.API_URL}/csrf`));
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status === 404) {
        throw new HttpErrorResponse({ status: 503, error: { message: '登入服務正在更新，請檢查網站更新後再試。' } });
      }
      throw error;
    }
  }

  prepareCsrf(): Observable<void> {
    return defer(() => {
      if (document.cookie.split(';').some(item => item.trim().startsWith(`${environment.xsrfCookieName}=`))) return of(void 0);
      return this.withAuthLock(() => from(this.ensureCsrf()), false);
    });
  }

  refreshCsrf(): Observable<void> {
    return this.withAuthLock(() => {
      document.cookie = `${environment.xsrfCookieName}=; Max-Age=0; Path=/; SameSite=Lax${environment.production ? '; Secure' : ''}`;
      return from(this.ensureCsrf());
    }, false);
  }

  private async bootstrapCsrf(): Promise<void> {
    if (!navigator.locks?.request) return;
    try {
      await navigator.locks.request('aladvlog-auth-cookie', () => this.ensureCsrf());
    } catch { /* Authentication actions show the browser support error. */ }
  }

  private setAuthenticatedState(user: User, session: AuthSession): void {
    this.validateSession(session);
    if (!user?.id) throw new HttpErrorResponse({ status: 503, error: { message: '登入服務正在更新，請檢查網站更新後再試。' } });
    if (this.currentUser()?.id && this.currentUser()?.id !== user.id) {
      this.local.invalidate(undefined, this.currentUser()!.id, false);
    }
    this.local.setOwner(user.id);
    this.currentUser.set(user);
    this.session.set(session);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    localStorage.removeItem(this.LOGOUT_PENDING_KEY);
    localStorage.setItem(this.MIGRATION_KEY, '1');
    this.logoutPending.set(false);
  }

  private storeSession(session: AuthSession): void {
    this.validateSession(session);
    if (session.id !== this.session()?.id) return;
    this.session.set(session);
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
  }

  private handleAuthSuccess(res: AuthResponse): void {
    this.sessionChanged.next();
    this.nextRenewAt = 0;
    this.setAuthenticatedState(res.user, res.session);
    this.recordCheck(res.user.id);
    this.clearAllCaches();
  }

  private clearLocalAuth(clearPending: boolean): void {
    this.local.invalidate(undefined, this.currentUser()?.id ?? null, false);
    this.local.setOwner(null);
    this.sessionChanged.next();
    this.nextRenewAt = 0;
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.SESSION_KEY);
    localStorage.removeItem(this.CHECK_KEY);
    if (clearPending) localStorage.removeItem(this.LOGOUT_PENDING_KEY);
    this.session.set(null);
    this.currentUser.set(null);
    this.clearAllCaches();
  }

  private removeLegacyAuthOnce(): void {
    if (localStorage.getItem(this.MIGRATION_KEY)) return;
    localStorage.removeItem('dnd_auth_token');
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.SESSION_KEY);
    localStorage.removeItem(this.CHECK_KEY);
    localStorage.setItem(this.MIGRATION_KEY, '1');
    this.currentUser.set(null);
    this.session.set(null);
  }

  private clearAllCaches(): void {
    this.characterService.clearCache();
    this.adventureService.clearCache();
    this.inventoryService.clearCache();
  }

  private getStoredSession(): AuthSession | null {
    try {
      const value = JSON.parse(localStorage.getItem(this.SESSION_KEY) ?? 'null');
      this.validateSession(value);
      return value;
    } catch { return null; }
  }

  private validateSession(value: AuthSession): void {
    if (!value?.id || !Number.isFinite(Date.parse(value.issuedAt)) || !Number.isFinite(Date.parse(value.expiresAt))) {
      throw new HttpErrorResponse({ status: 503, error: { message: '登入服務正在更新，請檢查網站更新後再試。' } });
    }
  }

  private getStoredUser(): User | null {
    try { return JSON.parse(localStorage.getItem(this.USER_KEY) ?? 'null'); }
    catch { return null; }
  }
}
