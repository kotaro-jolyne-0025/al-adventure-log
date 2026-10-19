import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';
import { firstValueFrom, Observable, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { authGuard } from './auth.guard';

describe('authGuard', () => {
  for (const restored of [true, false]) {
    it(restored ? 'waits for shared server restoration before allowing navigation' : 'redirects a missing or pending-logout session to login', async () => {
      const auth = { checkSessionIfNeeded: vi.fn(), restoreSession: vi.fn(() => of(restored)) };
      const target = { toString: () => '/login?returnUrl=%2Fcharacters' };
      const router = { createUrlTree: vi.fn(() => target) };
      TestBed.configureTestingModule({ providers: [
        { provide: AuthService, useValue: auth }, { provide: Router, useValue: router },
      ] });
      const result = TestBed.runInInjectionContext(() => authGuard({} as ActivatedRouteSnapshot, { url: '/characters' } as RouterStateSnapshot));
      expect(await firstValueFrom(result as Observable<unknown>)).toBe(restored ? true : target);
      expect(auth.checkSessionIfNeeded).toHaveBeenCalledOnce();
      expect(auth.restoreSession).toHaveBeenCalledOnce();
    });
  }
});
