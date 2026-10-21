import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('Authentication for Blob downloads', () => {
  const url = '/api/characters/c/exports?format=pdf';
  let sessionId: string | null;
  const auth = {
    session: () => sessionId ? { id: sessionId } : null,
    isCurrentSession: (id: string | null) => !!id && id === sessionId,
    prepareCsrf: () => of(undefined),
    fetchCurrentUser: vi.fn(() => of({})),
    refreshCsrf: vi.fn(() => of(undefined)),
    logout: vi.fn(),
  };
  let http: HttpTestingController;
  beforeEach(() => {
    sessionId = 'session-A';
    vi.clearAllMocks();
    TestBed.configureTestingModule({ providers: [
      provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(),
      { provide: AuthService, useValue: auth },
    ] });
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => { http.verify(); vi.restoreAllMocks(); });

  it('preserves successful files and sends the session header', () => {
    const next = vi.fn();
    TestBed.inject(HttpClient).get(url, { responseType: 'blob' }).subscribe(next);
    const request = http.expectOne(url);
    expect(request.request.headers.get('X-Session-Id')).toBe(sessionId);
    const file = new Blob(['%PDF'], { type: 'application/pdf' });
    request.flush(file);
    expect(next).toHaveBeenCalledWith(file);
    expect(auth.fetchCurrentUser).not.toHaveBeenCalled();
  });

  it.each([
    [409, 'AUTH_SESSION_CHANGED', 1, 0],
    [403, 'CSRF_INVALID', 0, 1],
    [409, 'RESOURCE_CHANGED', 0, 0],
    [403, 'FORBIDDEN', 0, 0],
  ] as const)('handles Blob error %s / %s without resending the request', async (status, code, refreshes, csrfRefreshes) => {
    const error = vi.fn();
    TestBed.inject(HttpClient).get(url, { responseType: 'blob' }).subscribe({ error });
    const body = new Blob([JSON.stringify({ code, message: '請重試' })], { type: 'application/json' });
    vi.spyOn(body, 'text').mockResolvedValue(JSON.stringify({ code, message: '請重試' }));
    http.expectOne(url).flush(body, { status, statusText: 'Rejected' });
    await vi.waitFor(() => expect(error).toHaveBeenCalledOnce());
    expect(auth.fetchCurrentUser).toHaveBeenCalledTimes(refreshes);
    expect(auth.refreshCsrf).toHaveBeenCalledTimes(csrfRefreshes);
    expect(auth.logout).not.toHaveBeenCalled();
    expect(error.mock.calls[0][0]).toBeInstanceOf(HttpErrorResponse);
    expect(error.mock.calls[0][0].error).toBe(body);
    expect(error.mock.calls[0][0].status).toBe(status);
    http.expectNone(url);
  });

  it.each(['invalid JSON', 'read rejection', 'read exception'])('preserves the original error on %s', async kind => {
    const error = vi.fn();
    TestBed.inject(HttpClient).get(url, { responseType: 'blob' }).subscribe({ error });
    const body = new Blob(['invalid JSON']);
    const text = vi.spyOn(body, 'text');
    if (kind === 'read rejection') text.mockRejectedValue(new Error('Read failed'));
    else if (kind === 'read exception') text.mockImplementation(() => { throw new Error('Read failed'); });
    else text.mockResolvedValue('invalid JSON');
    http.expectOne(url).flush(body, { status: 409, statusText: 'Conflict' });
    await vi.waitFor(() => expect(error).toHaveBeenCalledOnce());
    expect(error.mock.calls[0][0].error).toBe(body);
    expect(auth.fetchCurrentUser).not.toHaveBeenCalled();
    expect(auth.refreshCsrf).not.toHaveBeenCalled();
  });

  it.each([[409, 'AUTH_SESSION_CHANGED'], [403, 'CSRF_INVALID']] as const)('ignores an old session while reading error %s', async (status, code) => {
    const error = vi.fn();
    TestBed.inject(HttpClient).get(url, { responseType: 'blob' }).subscribe({ error });
    const body = new Blob([]);
    let finishRead!: (value: string) => void;
    vi.spyOn(body, 'text').mockReturnValue(new Promise(resolve => finishRead = resolve));
    http.expectOne(url).flush(body, { status, statusText: 'Rejected' });
    expect(body.text).toHaveBeenCalledOnce();
    sessionId = 'session-B';
    finishRead(JSON.stringify({ code }));
    await vi.waitFor(() => expect(error).toHaveBeenCalledOnce());
    expect(auth.fetchCurrentUser).not.toHaveBeenCalled();
    expect(auth.refreshCsrf).not.toHaveBeenCalled();
    expect(auth.logout).not.toHaveBeenCalled();
  });

  it('handles a Blob 401 immediately without waiting to read its body', () => {
    const error = vi.fn();
    TestBed.inject(HttpClient).get(url, { responseType: 'blob' }).subscribe({ error });
    const body = new Blob([]);
    const text = vi.spyOn(body, 'text').mockReturnValue(new Promise(() => {}));
    http.expectOne(url).flush(body, { status: 401, statusText: 'Unauthorized' });
    expect(auth.logout).toHaveBeenCalledExactlyOnceWith(true);
    expect(error).toHaveBeenCalledOnce();
    expect(text).not.toHaveBeenCalled();
  });

  it('does not refresh CSRF if the session changes before the queued refresh', async () => {
    const error = vi.fn(() => sessionId = 'session-B');
    TestBed.inject(HttpClient).get(url, { responseType: 'blob' }).subscribe({ error });
    const body = new Blob([]);
    vi.spyOn(body, 'text').mockResolvedValue('{"code":"CSRF_INVALID"}');
    http.expectOne(url).flush(body, { status: 403, statusText: 'Forbidden' });
    await vi.waitFor(() => expect(error).toHaveBeenCalledOnce());
    expect(auth.refreshCsrf).not.toHaveBeenCalled();
  });

  it.each(['json', 'blob'])('keeps public login CSRF recovery working with %s errors', async type => {
    sessionId = null;
    const client = TestBed.inject(HttpClient), error = vi.fn();
    const loginUrl = '/api/auth/login';
    const request = type === 'blob' ? client.post(loginUrl, {}, { responseType: 'blob' }) : client.post(loginUrl, {});
    request.subscribe({ error });
    const data = { code: 'CSRF_INVALID' };
    const body = new Blob([JSON.stringify(data)], { type: 'application/json' });
    vi.spyOn(body, 'text').mockResolvedValue(JSON.stringify(data));
    http.expectOne(loginUrl).flush(type === 'blob' ? body : data, { status: 403, statusText: 'Forbidden' });
    await vi.waitFor(() => expect(error).toHaveBeenCalledOnce());
    expect(auth.refreshCsrf).toHaveBeenCalledOnce();
    expect(auth.logout).not.toHaveBeenCalled();
  });
});
