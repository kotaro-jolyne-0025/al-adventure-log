import { HttpErrorResponse, HttpInterceptorFn, HttpXsrfTokenExtractor } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, defer, map, mergeMap, of, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const xsrf = inject(HttpXsrfTokenExtractor);
  const isApiRequest = req.url.startsWith('/api/');
  const isAuthRequest =
    req.url.includes('/api/auth/login') ||
    req.url.includes('/api/auth/register') ||
    req.url.includes('/api/auth/oauth') ||
    req.url.includes('/api/auth/forgot-password') ||
    req.url.includes('/api/auth/reset-password') ||
    req.url.includes('/api/auth/verify-reset-token') || req.url.includes('/api/auth/csrf');

  const sessionId = authService.session()?.id ?? null;
  const currentSession = () => sessionId ? authService.isCurrentSession(sessionId) : !authService.session();
  const isPublicAuthWrite = isAuthRequest || req.url.includes('/api/auth/logout');
  const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
  const dispatch = () => {
    let authReq = req;
    if (isApiRequest && !isPublicAuthWrite && sessionId) {
      authReq = req.clone({ setHeaders: { 'X-Session-Id': sessionId } });
    }
    const csrfToken = isApiRequest && unsafe ? xsrf.getToken() : null;
    if (csrfToken && !authReq.headers.has('X-XSRF-TOKEN')) {
      authReq = authReq.clone({ setHeaders: { 'X-XSRF-TOKEN': csrfToken } });
    }
    return next(authReq);
  };

  const ready = isApiRequest && unsafe ? authService.prepareCsrf().pipe(switchMap(dispatch)) : dispatch();
  return ready.pipe(
    catchError((err: unknown) => {
      const handle = (code: unknown) => {
        if (err instanceof HttpErrorResponse && err.status === 401 && !isAuthRequest) {
          if (isApiRequest && authService.isCurrentSession(sessionId)) {
            authService.logout(true);
          }
        }
        if (err instanceof HttpErrorResponse && err.status === 409 && code === 'AUTH_SESSION_CHANGED') {
          authService.fetchCurrentUser().subscribe({ error: () => {} });
        }
        if (err instanceof HttpErrorResponse && err.status === 403 && code === 'CSRF_INVALID') {
          queueMicrotask(() => {
            if (currentSession()) authService.refreshCsrf().subscribe({ error: () => {} });
          });
        }
        return throwError(() => err);
      };
      if (isApiRequest && err instanceof HttpErrorResponse && err.error instanceof Blob && [403, 409].includes(err.status)) {
        const body = err.error;
        return defer(() => body.text()).pipe(
          map(text => { try { return JSON.parse(text)?.code; } catch { return undefined; } }),
          catchError(() => of(undefined)),
          mergeMap(code => currentSession() ? handle(code) : throwError(() => err)),
        );
      }
      return handle(err instanceof HttpErrorResponse ? err.error?.code : undefined);
    })
  );
};
