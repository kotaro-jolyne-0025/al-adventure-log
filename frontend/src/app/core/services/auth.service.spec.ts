import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { CharacterService } from './character.service';
import { AdventureService } from './adventure.service';
import { InventoryService } from './inventory.service';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { environment } from '../../../environments/environment';
import { LocalStore } from './local-store.service';
import { AuthSession, User } from '../models/auth.model';

describe('Cookie authentication', () => {
  const api = `${environment.apiUrl}/auth`;
  const user: User = { id: 'A', email: 'a@example.invalid', displayName: 'Player A' };
  const session: AuthSession = { id: 'session-A', issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600_000).toISOString() };
  const router = { navigate: vi.fn() };
  const caches = [CharacterService, AdventureService, InventoryService].map(service => ({
    provide: service, useValue: { clearCache: vi.fn() },
  }));
  let http: HttpTestingController;
  let online: boolean;

  async function tick(): Promise<void> { await new Promise(resolve => setTimeout(resolve, 0)); }

  function saveSession(value: AuthSession): void {
    localStorage.setItem('dnd_auth_cookie_migration_v1', '1');
    localStorage.setItem('dnd_auth_session', JSON.stringify(value));
    localStorage.setItem('dnd_auth_user', JSON.stringify(user));
  }

  async function start(): Promise<AuthService> {
    const service = TestBed.inject(AuthService);
    await tick();
    return service;
  }

  beforeEach(() => {
    TestBed.resetTestingModule();
    localStorage.clear();
    document.cookie = `${environment.xsrfCookieName}=csrf-fixture; Path=/`;
    let tail: Promise<unknown> = Promise.resolve();
    Object.defineProperty(navigator, 'locks', { configurable: true, value: { request: (_name: string, callback: () => unknown) => {
      const next = tail.then(callback);
      tail = next.catch(() => {});
      return next;
    } } });
    online = true;
    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => online });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withXsrfConfiguration({ cookieName: environment.xsrfCookieName, headerName: 'X-XSRF-TOKEN' }), withInterceptors([authInterceptor])), provideHttpClientTesting(),
      { provide: Router, useValue: router }, ...caches,
    ] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
    localStorage.clear();
    document.cookie = `${environment.xsrfCookieName}=; Path=/; Max-Age=0`;
  });

  it('removes the old readable JWT and restores the session from the HttpOnly cookie', async () => {
    localStorage.setItem('dnd_auth_token', 'legacy-jwt');
    localStorage.setItem('dnd_auth_user', JSON.stringify(user));
    const service = await start();
    expect(localStorage.getItem('dnd_auth_token')).toBeNull();
    const request = http.expectOne(`${api}/me`);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ user, session });
    expect(service.currentUser()).toEqual(user);
    expect(service.session()).toEqual(session);
    expect(TestBed.inject(LocalStore).owner()).toBe(user.id);
  });

  it('stores only user and session metadata after password login', async () => {
    const service = await start();
    http.expectOne(`${api}/me`).flush({}, { status: 401, statusText: 'Unauthorized' });
    service.login({ email: user.email, password: 'password' }).subscribe();
    await tick();
    const request = http.expectOne(`${api}/login`);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ user, session });
    expect(service.isAuthenticated()).toBe(true);
    expect(localStorage.getItem('dnd_auth_session')).toContain(session.id);
    expect(localStorage.getItem('dnd_auth_token')).toBeNull();
  });

  it('binds protected requests to the session and does not log out on a CSRF rejection', async () => {
    const service = await start();
    http.expectOne(`${api}/me`).flush({ user, session });
    const errors = vi.fn();
    TestBed.inject(HttpClient).post(`${environment.apiUrl}/characters`, {}).subscribe({ error: errors });
    const request = http.expectOne(`${environment.apiUrl}/characters`);
    expect(request.request.headers.get('X-Session-Id')).toBe(session.id);
    expect(request.request.headers.get('X-XSRF-TOKEN')).toBe('csrf-fixture');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ code: 'CSRF_INVALID' }, { status: 403, statusText: 'Forbidden' });
    await new Promise(resolve => setTimeout(resolve, 0));
    http.expectOne(`${api}/csrf`).flush(null, { status: 204, statusText: 'No Content' });
    http.expectNone(`${environment.apiUrl}/characters`);
    expect(errors).toHaveBeenCalledTimes(1);
    expect(service.isAuthenticated()).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('does not add authentication headers to third-party requests', async () => {
    await start();
    http.expectOne(`${api}/me`).flush({}, { status: 401, statusText: 'Unauthorized' });
    TestBed.inject(HttpClient).get('https://third-party.example/data').subscribe();
    const request = http.expectOne('https://third-party.example/data');
    expect(request.request.headers.has('Authorization')).toBe(false);
    expect(request.request.headers.has('X-Session-Id')).toBe(false);
    expect(request.request.headers.has('X-XSRF-TOKEN')).toBe(false);
    request.flush({});
  });

  it('attaches a newly bootstrapped CSRF token to the first protected write', async () => {
    await start();
    http.expectOne(`${api}/me`).flush({ user, session });
    document.cookie = `${environment.xsrfCookieName}=; Path=/; Max-Age=0`;
    TestBed.inject(HttpClient).post(`${environment.apiUrl}/characters`, {}).subscribe();
    await tick();
    http.expectNone(`${environment.apiUrl}/characters`);
    document.cookie = `${environment.xsrfCookieName}=new-token; Path=/`;
    http.expectOne(`${api}/csrf`).flush(null, { status: 204, statusText: 'No Content' });
    await tick();
    const write = http.expectOne(`${environment.apiUrl}/characters`);
    expect(write.request.headers.get('X-XSRF-TOKEN')).toBe('new-token');
    write.flush({});
  });

  it('does not let an old session 401 clear a newer local login', async () => {
    const service = await start();
    http.expectOne(`${api}/me`).flush({ user, session });
    TestBed.inject(HttpClient).get(`${environment.apiUrl}/characters`).subscribe({ error: () => {} });
    const stale = http.expectOne(`${environment.apiUrl}/characters`);
    const nextSession = { ...session, id: 'session-B' };
    localStorage.setItem('dnd_auth_session', JSON.stringify(nextSession));
    localStorage.setItem('dnd_auth_user', JSON.stringify({ ...user, id: 'B' }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'dnd_auth_session', newValue: JSON.stringify(nextSession) }));
    stale.flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(service.session()).toEqual(nextSession);
    expect(service.currentUser()?.id).toBe('B');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('blocks cookie mutations when Web Locks are unavailable', async () => {
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
    const service = await start();
    http.expectOne(`${api}/me`).flush({}, { status: 401, statusText: 'Unauthorized' });
    const failure = vi.fn();
    service.login({ email: user.email, password: 'password' }).subscribe({ error: failure });
    await tick();
    expect(failure).toHaveBeenCalled();
    http.expectNone(`${api}/login`);
  });

  it('rejects an old backend response without storing its readable JWT', async () => {
    const service = await start();
    http.expectOne(`${api}/me`).flush({}, { status: 401, statusText: 'Unauthorized' });
    const failure = vi.fn();
    service.login({ email: user.email, password: 'password' }).subscribe({ error: failure });
    await tick();
    http.expectOne(`${api}/login`).flush({ token: 'legacy-jwt', user });
    await tick();
    expect(failure.mock.calls[0][0].error.message).toContain('更新');
    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('dnd_auth_token')).toBeNull();
    expect(localStorage.getItem('dnd_auth_session')).toBeNull();
  });

  it('asks for an update when an old backend has no CSRF bootstrap endpoint', async () => {
    const service = await start();
    http.expectOne(`${api}/me`).flush({}, { status: 401, statusText: 'Unauthorized' });
    document.cookie = `${environment.xsrfCookieName}=; Path=/; Max-Age=0`;
    const failure = vi.fn();
    service.login({ email: user.email, password: 'password' }).subscribe({ error: failure });
    await tick();
    http.expectOne(`${api}/csrf`).flush({}, { status: 404, statusText: 'Not Found' });
    await tick();
    http.expectNone(`${api}/login`);
    expect(failure.mock.calls[0][0].error.message).toContain('更新');
    expect(localStorage.getItem('dnd_auth_token')).toBeNull();
  });

  it('initializes CSRF before draining offline logout and then allows a new login', async () => {
    const service = await start();
    http.expectOne(`${api}/me`).flush({ user, session });
    online = false;
    service.logout(false);
    const restored: boolean[] = [];
    service.restoreSession().subscribe(value => restored.push(value));
    expect(restored).toEqual([false]);
    document.cookie = `${environment.xsrfCookieName}=; Path=/; Max-Age=0`;
    online = true;
    service.login({ email: user.email, password: 'password' }).subscribe();
    await tick();
    http.expectNone(`${api}/logout`);
    document.cookie = `${environment.xsrfCookieName}=fresh; Path=/`;
    http.expectOne(`${api}/csrf`).flush(null, { status: 204, statusText: 'No Content' });
    await tick();
    http.expectOne(`${api}/logout`).flush(null, { status: 204, statusText: 'No Content' });
    await tick();
    const nextSession = { ...session, id: 'session-B' };
    http.expectOne(`${api}/login`).flush({ user, session: nextSession });
    await tick();
    expect(service.session()).toEqual(nextSession);
    expect(service.logoutPending()).toBe(false);
  });

  it('finishes pending logout after reopening online and never restores the old account first', async () => {
    saveSession(session);
    localStorage.setItem('dnd_auth_logout_pending', 'offline-intent');
    const service = await start();
    http.expectNone(`${api}/me`);
    expect(service.isAuthenticated()).toBe(false);
    http.expectOne(`${api}/logout`).flush(null, { status: 204, statusText: 'No Content' });
    await tick();
    expect(service.logoutPending()).toBe(false);
  });

  it('holds the lock through renewal, logout and a new login in that order', async () => {
    const service = await start();
    const old = { ...session, issuedAt: new Date(Date.now() - 11 * 60_000).toISOString() };
    http.expectOne(`${api}/me`).flush({ user, session: old });
    service.renewOnActivity();
    await tick();
    const renewal = http.expectOne(`${api}/renew`);
    service.logout(false);
    service.login({ email: user.email, password: 'password' }).subscribe();
    await tick();
    http.expectNone(`${api}/logout`);
    http.expectNone(`${api}/login`);
    renewal.flush({ session: { ...session, id: old.id } });
    await tick();
    http.expectOne(`${api}/logout`).flush(null, { status: 204, statusText: 'No Content' });
    await tick();
    http.expectOne(`${api}/login`).flush({ user, session: { ...session, id: 'session-B' } });
    await tick();
    expect(service.session()?.id).toBe('session-B');
    expect(service.logoutPending()).toBe(false);
    http.expectNone(`${api}/logout`);
  });

  it('rechecks shared issue time after waiting for a lock and keeps caches for the same login', async () => {
    const service = await start();
    const old = { ...session, issuedAt: new Date(Date.now() - 11 * 60_000).toISOString() };
    http.expectOne(`${api}/me`).flush({ user, session: old });
    vi.clearAllMocks();
    let release!: () => void;
    void navigator.locks.request('aladvlog-auth-cookie', () => new Promise<void>(resolve => release = resolve));
    await tick();
    service.renewOnActivity();
    saveSession(session);
    const check = localStorage.getItem('dnd_auth_check');
    window.dispatchEvent(new StorageEvent('storage', { key: 'dnd_auth_session', newValue: JSON.stringify(session) }));
    release();
    await tick();
    http.expectNone(`${api}/renew`);
    expect(service.session()).toEqual(session);
    expect(localStorage.getItem('dnd_auth_check')).toBe(check);
    for (const cache of caches) expect(cache.useValue.clearCache).not.toHaveBeenCalled();
  });

  it('shares restoration and throttles daily checks without discarding a session on temporary failure', async () => {
    const service = await start();
    const done = vi.fn();
    service.restoreSession().subscribe(done);
    service.restoreSession().subscribe(done);
    const longSession = { ...session, expiresAt: new Date(Date.now() + 7 * 86400_000).toISOString() };
    http.expectOne(`${api}/me`).flush({ user, session: longSession });
    expect(done).toHaveBeenCalledTimes(2);
    service.checkSessionIfNeeded();
    http.expectNone(`${api}/me`);
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 86400_001);
    service.checkSessionIfNeeded();
    http.expectOne(`${api}/me`).flush({}, { status: 503, statusText: 'Unavailable' });
    expect(service.isAuthenticated()).toBe(true);
    service.checkSessionIfNeeded();
    http.expectNone(`${api}/me`);
  });

  it('reconciles interrupted cookie writes despite a recent daily check', async () => {
    saveSession(session);
    localStorage.setItem('dnd_auth_check', JSON.stringify({ userId: user.id, checkedAt: Date.now() }));
    localStorage.setItem('dnd_auth_cookie_inflight', '1');
    const service = await start();
    const nextSession = { ...session, id: 'session-B' };
    http.expectOne(`${api}/me`).flush({ user: { ...user, id: 'B' }, session: nextSession });
    await tick();
    expect(service.currentUser()?.id).toBe('B');
    expect(service.session()).toEqual(nextSession);
    expect(localStorage.getItem('dnd_auth_cookie_inflight')).toBeNull();
  });

  it('renews only in the foreground after ten minutes and backs off for one minute', async () => {
    const service = await start();
    http.expectOne(`${api}/me`).flush({ user, session });
    service.renewOnActivity();
    await tick();
    http.expectNone(`${api}/renew`);
    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 11 * 60_000);
    online = false;
    service.renewOnActivity();
    online = true;
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' });
    service.renewOnActivity();
    await tick();
    http.expectNone(`${api}/renew`);
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    service.renewOnActivity();
    await tick();
    http.expectOne(`${api}/renew`).flush({}, { status: 503, statusText: 'Unavailable' });
    await tick();
    service.renewOnActivity();
    await tick();
    http.expectNone(`${api}/renew`);
    vi.mocked(Date.now).mockReturnValue(now + 12 * 60_000 + 1);
    const check = localStorage.getItem('dnd_auth_check');
    vi.clearAllMocks();
    service.renewOnActivity();
    await tick();
    http.expectOne(`${api}/renew`).flush({ session: { ...session, issuedAt: new Date(Date.now()).toISOString() } });
    await tick();
    expect(service.isAuthenticated()).toBe(true);
    expect(localStorage.getItem('dnd_auth_check')).toBe(check);
    for (const cache of caches) expect(cache.useValue.clearCache).not.toHaveBeenCalled();
  });
});
