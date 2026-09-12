import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.token();

  let authReq = req;
  if (token && !req.url.startsWith('https://discord.com') && !req.url.startsWith('https://oauth2.googleapis.com')) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return next(authReq).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401) {
        // Token 失效或未授權，自動觸發登出
        if (!req.url.includes('/api/auth/login') && !req.url.includes('/api/auth/register')) {
          authService.logout(true);
        }
      }
      return throwError(() => err);
    })
  );
};
