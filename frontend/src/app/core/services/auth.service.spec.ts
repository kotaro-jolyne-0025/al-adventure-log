import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from './auth.service';
import { CharacterService } from './character.service';
import { AdventureService } from './adventure.service';
import { InventoryService } from './inventory.service';
import { authInterceptor } from '../interceptors/auth.interceptor';
import { authGuard } from '../guards/auth.guard';
import { User } from '../models/auth.model';
import { environment } from '../../../environments/environment';
import { LocalStore } from './local-store.service';

describe('Daily account confirmation', () => {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.UTC(2026, 9, 11, 12);
  const api = `${environment.apiUrl}/auth`;
  const user: User = { id: 'A', email: 'a@example.invalid', displayName: 'Player A' };
  const other: User = { id: 'B', email: 'b@example.invalid', displayName: 'Player B' };
  const router = { navigate: vi.fn(), createUrlTree: vi.fn(() => 'login') };
  const caches = [CharacterService, AdventureService, InventoryService].map(service => ({
    provide: service, useValue: { clearCache: vi.fn() },
  }));
  let http: HttpTestingController;
  let loginSequence = 0;

  function token(id = 'A', expiry = now + 7 * day, sessionId = id, issuedAt = now): string {
    return `header.${btoa(JSON.stringify({ sub: id, exp: expiry / 1000, iat: issuedAt / 1000, sessionId }))}.signature`;
  }

  function storedSession(check: unknown = { userId: user.id, checkedAt: now }): void {
    localStorage.setItem('dnd_auth_token', token());
    localStorage.setItem('dnd_auth_user', JSON.stringify(user));
    if (check !== null) localStorage.setItem('dnd_auth_check', JSON.stringify(check));
  }

  async function start(): Promise<AuthService> {
    const service = TestBed.inject(AuthService);
    await Promise.resolve();
    return service;
  }

  function navigate(): unknown {
    return TestBed.runInInjectionContext(() => authGuard(
      {} as ActivatedRouteSnapshot, { url: '/characters' } as RouterStateSnapshot,
    ));
  }

  function loginAs(service: AuthService, account: User): void {
    service.login({ email: account.email, password: 'test-password' }).subscribe();
    http.expectOne(`${api}/login`).flush({ token: token(account.id, now + 7 * day, `${account.id}-new-login-${++loginSequence}`), tokenType: 'Bearer', user: account });
  }

  beforeEach(() => {
    localStorage.clear();
    loginSequence = 0;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
      { provide: Router, useValue: router }, ...caches,
    ] });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('surfaces a rate limit response without automatically retrying login', async () => {
    const service = await start();
    const failure = vi.fn();
    service.login({ email: user.email, password: 'wrong-password' }).subscribe({ error: failure });
    http.expectOne(`${api}/login`).flush(
      { status: 429, message: '嘗試次數過多，請稍後再試' },
      { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '900' } },
    );
    expect(failure).toHaveBeenCalledTimes(1);
    expect(failure.mock.calls[0][0].status).toBe(429);
    http.expectNone(`${api}/login`);
  });

  it('stores no session or pending proof until a new OAuth player confirms a nickname', async () => {
    const service = await start();
    service.loginOAuth({ provider: 'GOOGLE', tokenOrCode: 'provider-fixture' }).subscribe();
    http.expectOne(`${api}/oauth`).flush({ registrationRequired: true, registrationToken: 'pending-proof' });
    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('dnd_auth_token')).toBeNull();
    expect(localStorage.getItem('dnd_auth_user')).toBeNull();
    expect(JSON.stringify(localStorage)).not.toContain('pending-proof');
    service.registerOAuth('pending-proof', '自選暱稱').subscribe();
    const request = http.expectOne(`${api}/oauth/register`);
    expect(request.request.body).toEqual({ registrationToken: 'pending-proof', displayName: '自選暱稱' });
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ token: token(), tokenType: 'Bearer', user: { ...user, displayName: '自選暱稱' } });
    expect(service.isAuthenticated()).toBe(true);
    expect(service.currentUser()?.displayName).toBe('自選暱稱');
    expect(localStorage.getItem('dnd_auth_token')).toBe(token());
  });

  it('uses the stored account on reload and repeated navigation within 24 hours', async () => {
    storedSession({ userId: user.id, checkedAt: now - day + 1 });
    const service = await start();
    expect(navigate()).toBe(true);
    expect(navigate()).toBe(true);
    http.expectNone(`${api}/me`);
    expect(service.currentUser()).toEqual(user);
  });

  it('confirms once at the 24-hour boundary and again on navigation the next day', async () => {
    storedSession({ userId: user.id, checkedAt: now - day });
    await start();
    expect(navigate()).toBe(true);
    expect(navigate()).toBe(true);
    const request = http.expectOne(`${api}/me`);
    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${token()}`);
    request.flush(user);
    vi.mocked(Date.now).mockReturnValue(now + day);
    expect(navigate()).toBe(true);
    expect(navigate()).toBe(true);
    http.expectOne(`${api}/me`).flush(user);
  });

  it.each([null, { userId: 'B', checkedAt: now }, { userId: 'A', checkedAt: now + 1 },
    { userId: 'A', checkedAt: 'today' }])('recovers a missing or invalid check record: %j', async check => {
    storedSession(check);
    await start();
    http.expectOne(`${api}/me`).flush(user);
  });

  it('recovers malformed JSON and saves a refreshed display name', async () => {
    storedSession();
    localStorage.setItem('dnd_auth_check', 'broken');
    const service = await start();
    const refreshed = { ...user, displayName: 'Updated' };
    http.expectOne(`${api}/me`).flush(refreshed);
    expect(service.currentUser()).toEqual(refreshed);
    expect(JSON.parse(localStorage.getItem('dnd_auth_user')!)).toEqual(refreshed);
  });

  it('fetches the account when cached user data is missing despite a recent check', async () => {
    storedSession();
    localStorage.removeItem('dnd_auth_user');
    const service = await start();
    expect(TestBed.inject(LocalStore).owner()).toBeNull();
    http.expectOne(`${api}/me`).flush(user);
    expect(service.isAuthenticated()).toBe(true);
    expect(TestBed.inject(LocalStore).owner()).toBe(user.id);
  });

  it.each([0, 503])('keeps the cached account and throttles retries after temporary status %s', async status => {
    storedSession(null);
    const service = await start();
    const request = http.expectOne(`${api}/me`);
    if (status === 0) request.error(new ProgressEvent('error'));
    else request.flush({}, { status, statusText: 'Unavailable' });
    expect(service.isAuthenticated()).toBe(true);
    expect(navigate()).toBe(true);
    http.expectNone(`${api}/me`);
    // A newly created service, like reloading the app, uses the persisted attempt time.
    const reloaded = TestBed.runInInjectionContext(() => new AuthService());
    await Promise.resolve();
    expect(reloaded.currentUser()).toEqual(user);
    http.expectNone(`${api}/me`);
  });

  it('clears an expired token locally even when the daily check is recent', async () => {
    storedSession();
    localStorage.setItem('dnd_auth_token', token('A', now));
    const service = await start();
    http.expectNone(`${api}/me`);
    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('dnd_auth_check')).toBeNull();
    expect(navigate()).toBe('login');
  });

  it('logs out immediately when a protected API rejects a recently checked token', async () => {
    storedSession();
    const service = await start();
    const client = TestBed.inject(HttpClient);
    client.get(`${environment.apiUrl}/characters`).subscribe({ error: () => {} });
    http.expectOne(`${environment.apiUrl}/characters`).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(service.isAuthenticated()).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
    expect(caches.every(cache => cache.useValue.clearCache.mock.calls.length > 0)).toBe(true);
  });

  it('clears the session when the background confirmation returns 401', async () => {
    storedSession(null);
    const service = await start();
    http.expectOne(`${api}/me`).flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(service.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('dnd_auth_check')).toBeNull();
  });

  it('marks a fresh login as confirmed and clears its record on manual logout', async () => {
    const service = await start();
    loginAs(service, user);
    expect(navigate()).toBe(true);
    http.expectNone(`${api}/me`);
    service.logout();
    expect(service.token()).toBeNull();
    expect(localStorage.getItem('dnd_auth_user')).toBeNull();
    expect(localStorage.getItem('dnd_auth_check')).toBeNull();
  });

  it('cancels a pending account check and profile update on logout', async () => {
    storedSession(null);
    const service = await start();
    const oldCheck = http.expectOne(`${api}/me`);
    const receiver = vi.fn();
    service.updateProfile('New name').subscribe(receiver);
    const oldUpdate = http.expectOne(`${api}/me`);
    service.logout(false);
    expect(oldCheck.cancelled).toBe(true);
    expect(oldUpdate.cancelled).toBe(true);
    expect(receiver).not.toHaveBeenCalled();
    expect(service.currentUser()).toBeNull();
  });

  it('cancels an old account check when another account logs in', async () => {
    storedSession(null);
    const service = await start();
    const old = http.expectOne(`${api}/me`);
    loginAs(service, other);
    expect(old.cancelled).toBe(true);
    expect(service.currentUser()).toEqual(other);
    expect(navigate()).toBe(true);
    http.expectNone(`${api}/me`);
  });

  it('renews on foreground input without cancelling pending reads or clearing caches', async () => {
    storedSession();
    const old = token('A', now + 60 * 60_000, 'A', now - 11 * 60_000);
    localStorage.setItem('dnd_auth_token', old);
    const service = await start();
    const receiver = vi.fn();
    service.fetchCurrentUser().subscribe(receiver);
    const profile = http.expectOne(`${api}/me`);
    const checks = localStorage.getItem('dnd_auth_check');
    vi.clearAllMocks();
    window.dispatchEvent(new Event('input'));
    const renewal = http.expectOne(`${api}/renew`);
    expect(renewal.request.headers.get('Authorization')).toBe(`Bearer ${old}`);
    window.dispatchEvent(new Event('keydown'));
    http.expectNone(`${api}/renew`);
    const next = token('A', now + 2 * 60 * 60_000);
    renewal.flush({ token: next });
    expect(service.token()).toBe(next);
    expect(localStorage.getItem('dnd_auth_token')).toBe(next);
    expect(localStorage.getItem('dnd_auth_check')).toBe(checks);
    expect(profile.cancelled).toBe(false);
    expect(caches.every(cache => cache.useValue.clearCache.mock.calls.length === 0)).toBe(true);
    profile.flush(user);
    expect(receiver).toHaveBeenCalledWith(user);
    window.dispatchEvent(new Event('scroll'));
    http.expectNone(`${api}/renew`);
  });

  it('does not renew because of background requests, hidden pages, offline state or expired tokens', async () => {
    storedSession();
    localStorage.setItem('dnd_auth_token', token('A', now + 60 * 60_000, 'A', now - 11 * 60_000));
    const service = await start();
    service.fetchCurrentUser().subscribe();
    http.expectOne(`${api}/me`).flush(user);
    http.expectNone(`${api}/renew`);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    window.dispatchEvent(new Event('pointerdown'));
    http.expectNone(`${api}/renew`);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    window.dispatchEvent(new Event('input'));
    http.expectNone(`${api}/renew`);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    vi.mocked(Date.now).mockReturnValue(now + 2 * 60 * 60_000);
    window.dispatchEvent(new Event('keydown'));
    http.expectNone(`${api}/renew`);
  });

  it('backs off temporary renewal failures and keeps the original session', async () => {
    storedSession();
    const old = token('A', now + 60 * 60_000, 'A', now - 11 * 60_000);
    localStorage.setItem('dnd_auth_token', old);
    const service = await start();
    service.renewOnActivity();
    http.expectOne(`${api}/renew`).flush({}, { status: 503, statusText: 'Unavailable' });
    expect(service.token()).toBe(old);
    service.renewOnActivity();
    http.expectNone(`${api}/renew`);
    vi.mocked(Date.now).mockReturnValue(now + 60_000);
    service.renewOnActivity();
    http.expectOne(`${api}/renew`).flush({ token: token('A', now + 2 * 60 * 60_000, 'A', now - 11 * 60_000) });
    service.renewOnActivity();
    http.expectNone(`${api}/renew`);
    vi.mocked(Date.now).mockReturnValue(now + 2 * 60_000);
    service.renewOnActivity();
    http.expectNone(`${api}/renew`);
    vi.mocked(Date.now).mockReturnValue(now + 11 * 60_000);
    service.renewOnActivity();
    http.expectOne(`${api}/renew`).flush({ token: token('A', now + 3 * 60 * 60_000, 'A', now + 11 * 60_000) });
  });

  it('accepts cross-tab renewal without cancelling work and rejects shorter expirations', async () => {
    storedSession();
    const old = token('A', now + 60 * 60_000);
    localStorage.setItem('dnd_auth_token', old);
    const service = await start();
    service.updateProfile('New name').subscribe();
    const profile = http.expectOne(`${api}/me`);
    vi.clearAllMocks();
    const newer = token('A', now + 2 * 60 * 60_000);
    localStorage.setItem('dnd_auth_token', newer);
    window.dispatchEvent(new StorageEvent('storage', { key: 'dnd_auth_token', newValue: newer }));
    expect(service.token()).toBe(newer);
    expect(profile.cancelled).toBe(false);
    expect(caches.every(cache => cache.useValue.clearCache.mock.calls.length === 0)).toBe(true);
    localStorage.setItem('dnd_auth_token', old);
    window.dispatchEvent(new StorageEvent('storage', { key: 'dnd_auth_token', newValue: old }));
    expect(localStorage.getItem('dnd_auth_token')).toBe(newer);
    expect(service.token()).toBe(newer);
    profile.flush({ ...user, displayName: 'New name' });
  });

  it('cancels pending renewal on logout or a fresh login for the same account', async () => {
    storedSession();
    localStorage.setItem('dnd_auth_token', token('A', now + 60 * 60_000, 'A', now - 11 * 60_000));
    const service = await start();
    service.renewOnActivity();
    const renewal = http.expectOne(`${api}/renew`);
    loginAs(service, user);
    expect(renewal.cancelled).toBe(true);
    expect(service.token()).toBe(token('A', now + 7 * day, 'A-new-login-1'));
    vi.mocked(Date.now).mockReturnValue(now + 11 * 60_000);
    service.renewOnActivity();
    const pending = http.expectOne(`${api}/renew`);
    service.logout(false);
    expect(pending.cancelled).toBe(true);
    expect(service.token()).toBeNull();
  });

  it('does not overwrite a login stored by another tab before its storage event arrives', async () => {
    storedSession();
    const old = token('A', now + 60 * 60_000, 'A', now - 11 * 60_000);
    localStorage.setItem('dnd_auth_token', old);
    const service = await start();
    service.renewOnActivity();
    const renewal = http.expectOne(`${api}/renew`);
    const newLogin = token('A', now + 2 * 60 * 60_000, 'A-new-login');
    localStorage.setItem('dnd_auth_token', newLogin);
    renewal.flush({ token: token('A', now + 2 * 60 * 60_000) });
    expect(localStorage.getItem('dnd_auth_token')).toBe(newLogin);
    expect(service.token()).toBe(old);
  });

  it('handles a pending request 401 after same-session renewal but protects a fresh login', async () => {
    storedSession();
    const service = await start();
    const client = TestBed.inject(HttpClient);
    client.get(`${environment.apiUrl}/characters`).subscribe({ error: () => {} });
    const previous = http.expectOne(`${environment.apiUrl}/characters`);
    const newer = token('A', now + 8 * day);
    localStorage.setItem('dnd_auth_token', newer);
    window.dispatchEvent(new StorageEvent('storage', { key: 'dnd_auth_token', newValue: newer }));
    previous.flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(service.isAuthenticated()).toBe(false);
    loginAs(service, user);
    client.get(`${environment.apiUrl}/characters`).subscribe({ error: () => {} });
    const old = http.expectOne(`${environment.apiUrl}/characters`);
    service.logout(false);
    loginAs(service, user);
    old.flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(service.currentUser()).toEqual(user);
    expect(service.isAuthenticated()).toBe(true);
  });

  it('does not clear another tab login when an old 401 precedes its storage event', async () => {
    storedSession();
    const service = await start();
    TestBed.inject(HttpClient).get(`${environment.apiUrl}/characters`).subscribe({ error: () => {} });
    const old = http.expectOne(`${environment.apiUrl}/characters`);
    const current = token('B', now + 2 * 60 * 60_000, 'B-new-login');
    localStorage.setItem('dnd_auth_token', current);
    localStorage.setItem('dnd_auth_user', JSON.stringify(other));
    old.flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(localStorage.getItem('dnd_auth_token')).toBe(current);
    expect(router.navigate).not.toHaveBeenCalled();
    window.dispatchEvent(new StorageEvent('storage', { key: 'dnd_auth_token', newValue: current }));
    expect(service.currentUser()).toEqual(other);
  });

  it('does not let an old data request 401 log out a newly signed-in account', async () => {
    storedSession();
    const service = await start();
    TestBed.inject(HttpClient).delete(`${environment.apiUrl}/characters/old`).subscribe({ error: () => {} });
    const old = http.expectOne(`${environment.apiUrl}/characters/old`);
    loginAs(service, other);
    old.flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(service.currentUser()).toEqual(other);
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
