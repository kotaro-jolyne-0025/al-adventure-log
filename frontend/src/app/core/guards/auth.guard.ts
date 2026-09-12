import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // 每次路由切換都即時檢查：有登入狀態 且 token 尚未過期
  if (authService.isAuthenticated() && !authService.isTokenExpired()) {
    return true;
  }

  // Token 存在但已過期：主動清除過期的登入狀態
  if (authService.token()) {
    authService.logout(false);
  }

  // 尚未登入或 token 已過期，記住原目標網址並重定向至登入頁
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url },
  });
};
