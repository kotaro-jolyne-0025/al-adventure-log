import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { AuthResponse, OAuthLoginResponse } from '../../../core/models/auth.model';
import { OAuthCallbackComponent } from './oauth-callback.component';

describe('Discord callback registration', () => {
  let response: Subject<OAuthLoginResponse>;
  let confirmation: Subject<AuthResponse | undefined>;
  let loginOAuth: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;
  let open: ReturnType<typeof vi.fn>;
  let queryParams: Record<string, string>;
  let component: OAuthCallbackComponent;

  beforeEach(() => {
    response = new Subject(); confirmation = new Subject();
    loginOAuth = vi.fn(() => response); navigate = vi.fn();
    open = vi.fn(() => ({ afterClosed: () => confirmation }));
    queryParams = { code: 'one-use-code', state: 'expected-state' };
    sessionStorage.setItem('oauth_state_discord', 'expected-state');
    TestBed.configureTestingModule({ providers: [
      { provide: AuthService, useValue: { loginOAuth } },
      { provide: Router, useValue: { navigate } },
      { provide: MatDialog, useValue: { open } },
      { provide: MatSnackBar, useValue: { open: vi.fn() } },
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ provider: 'discord' }), queryParams } } },
    ] });
    component = TestBed.runInInjectionContext(() => new OAuthCallbackComponent());
  });
  afterEach(() => sessionStorage.clear());

  it('exchanges the code once and waits for the shared nickname dialog', () => {
    component.ngOnInit();
    response.next({ registrationRequired: true, registrationToken: 'pending-proof' });
    expect(open.mock.calls[0][1].data).toEqual({ registrationToken: 'pending-proof' });
    expect(navigate).not.toHaveBeenCalled();
    confirmation.next({ token: 'app-token', tokenType: 'Bearer', user: { id: 'qa', email: 'qa@example.invalid', displayName: '自選暱稱' } });
    expect(loginOAuth).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(['/characters']);
    expect(sessionStorage.getItem('oauth_state_discord')).toBeNull();
  });

  it('returns to login when the new player cancels', () => {
    component.ngOnInit();
    response.next({ registrationRequired: true, registrationToken: 'pending-proof' });
    confirmation.next(undefined);
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });

  it('logs existing players in directly', () => {
    component.ngOnInit();
    response.next({ token: 'app-token', tokenType: 'Bearer', user: { id: 'qa', email: 'qa@example.invalid', displayName: '既有暱稱' } });
    expect(open).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/characters']);
  });

  it.each(['missing', 'mismatch'])('rejects %s state before exchanging a provider code', state => {
    if (state === 'missing') sessionStorage.removeItem('oauth_state_discord');
    else queryParams['state'] = 'wrong-state';
    component.ngOnInit();
    expect(loginOAuth).not.toHaveBeenCalled();
    expect(component.errorMessage()).toContain('安全性校驗失敗');
  });
});
