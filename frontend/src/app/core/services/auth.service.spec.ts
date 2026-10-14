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

  function token(id = 'A', expiry = now + 7 * day): string {
    return `header.${btoa(JSON.stringify({ sub: id, exp: expiry / 1000 }))}.signature`;
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
    http.expectOne(`${api}/login`).flush({ token: token(account.id), tokenType: 'Bearer', user: account });
  }

  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(Date, 'now').mockReturnValue(now);
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
