import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }

  // 尚未登入，記住原目標網址並重定向至登入頁
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};
