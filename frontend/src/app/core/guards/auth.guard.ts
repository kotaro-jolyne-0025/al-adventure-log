import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { map } from 'rxjs';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  authService.checkSessionIfNeeded();
  return authService.restoreSession().pipe(map(restored => restored
    ? true
    : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } })));
};
