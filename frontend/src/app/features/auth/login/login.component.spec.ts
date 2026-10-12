import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/services/auth.service';
import { AuthResponse } from '../../../core/models/auth.model';

describe('Google sign-in callback', () => {
  let response: Subject<AuthResponse>;
  let loginOAuth: ReturnType<typeof vi.fn>;
  let navigateByUrl: ReturnType<typeof vi.fn>;
  let initialize: ReturnType<typeof vi.fn>;
  let renderButton: ReturnType<typeof vi.fn>;
  let queryParams: Record<string,string>;
  let component: LoginComponent;

  beforeEach(() => {
    response = new Subject(); loginOAuth = vi.fn(() => response); navigateByUrl = vi.fn();
    initialize = vi.fn(); renderButton = vi.fn(); queryParams = { returnUrl: '/characters/c/inventory' };
    vi.stubGlobal('google', { accounts: { id: { initialize, renderButton } } });
    const container = document.createElement('div'); container.id = 'google-btn-container';
    Object.defineProperty(container, 'offsetWidth', { value: 500 }); document.body.append(container);
    TestBed.configureTestingModule({ providers: [
      { provide: AuthService, useValue: { loginOAuth } },
      { provide: Router, useValue: { navigateByUrl } },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParams } } },
      { provide: MatSnackBar, useValue: { open: vi.fn() } },
    ] });
    component = TestBed.runInInjectionContext(() => new LoginComponent());
  });
  afterEach(() => { document.getElementById('google-btn-container')?.remove(); vi.unstubAllGlobals(); });

  it('uses popup ID tokens, caps button width and prevents concurrent callback requests', () => {
    component.ngAfterViewInit();
    expect(initialize.mock.calls[0][0]).toMatchObject({ ux_mode: 'popup', auto_select: false });
    expect(renderButton.mock.calls[0][1].width).toBe(400);
    const callback = initialize.mock.calls[0][0].callback;
    callback({ credential: 'test-id-token' }); callback({ credential: 'test-id-token' });
    expect(loginOAuth).toHaveBeenCalledExactlyOnceWith({ provider: 'GOOGLE', tokenOrCode: 'test-id-token' });
    response.next({ token:'app-token', user:{ id:'qa',email:'qa@example.invalid',displayName:'QA' } } as AuthResponse);
    expect(navigateByUrl).toHaveBeenCalledWith('/characters/c/inventory');
  });

  it.each(['//example.invalid', '/\\example.invalid', 'https://example.invalid'])('rejects unsafe return URL %s', target => {
    queryParams['returnUrl'] = target; component.ngAfterViewInit();
    initialize.mock.calls[0][0].callback({ credential:'test-id-token' });
    response.next({ token:'app-token',user:{displayName:'QA'} } as AuthResponse);
    expect(navigateByUrl).toHaveBeenCalledWith('/characters');
  });

  it('keeps the user on login when verification fails and restores retry', () => {
    component.ngAfterViewInit(); initialize.mock.calls[0][0].callback({ credential:'test-id-token' });
    response.error({ error: { message:'Google 憑證已過期' } });
    expect(component.isLoading()).toBe(false); expect(component.errorMessage()).toContain('已過期');
    expect(navigateByUrl).not.toHaveBeenCalled();
  });

  it('does not submit an empty credential', () => {
    component.ngAfterViewInit(); initialize.mock.calls[0][0].callback({ credential:'' });
    expect(loginOAuth).not.toHaveBeenCalled(); expect(component.errorMessage()).toBeTruthy();
  });
});
