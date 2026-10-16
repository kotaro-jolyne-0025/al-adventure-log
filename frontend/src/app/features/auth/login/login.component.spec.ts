import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { LoginComponent } from './login.component';
import { AuthService } from '../../../core/services/auth.service';
import { AuthResponse, OAuthLoginResponse } from '../../../core/models/auth.model';
import { environment } from '../../../../environments/environment';

describe('Google sign-in callback', () => {
  let response: Subject<OAuthLoginResponse>;
  let confirmation: Subject<AuthResponse | undefined>;
  let openDialog: ReturnType<typeof vi.fn>;
  let loginOAuth: ReturnType<typeof vi.fn>;
  let navigateByUrl: ReturnType<typeof vi.fn>;
  let initialize: ReturnType<typeof vi.fn>;
  let renderButton: ReturnType<typeof vi.fn>;
  let queryParams: Record<string,string>;
  let component: LoginComponent;
  let originalGoogleClientId: string;
  let originalDiscordClientId: string;

  beforeEach(() => {
    originalGoogleClientId = environment.googleClientId;
    originalDiscordClientId = environment.discordClientId;
    environment.googleClientId = 'google-test-client';
    environment.discordClientId = 'discord-test-client';
    response = new Subject(); loginOAuth = vi.fn(() => response); navigateByUrl = vi.fn();
    confirmation = new Subject(); openDialog = vi.fn(() => ({ afterClosed: () => confirmation }));
    initialize = vi.fn(); renderButton = vi.fn(); queryParams = { returnUrl: '/characters/c/inventory' };
    vi.stubGlobal('google', { accounts: { id: { initialize, renderButton } } });
    const container = document.createElement('div'); container.id = 'google-btn-container';
    Object.defineProperty(container, 'offsetWidth', { value: 500 }); document.body.append(container);
    TestBed.configureTestingModule({ providers: [
      { provide: AuthService, useValue: { loginOAuth } },
      { provide: Router, useValue: { navigateByUrl } },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParams } } },
      { provide: MatSnackBar, useValue: { open: vi.fn() } },
      { provide: MatDialog, useValue: { open: openDialog } },
    ] });
    component = TestBed.runInInjectionContext(() => new LoginComponent());
  });
  afterEach(() => {
    environment.googleClientId = originalGoogleClientId;
    environment.discordClientId = originalDiscordClientId;
    document.getElementById('google-btn-container')?.remove(); vi.unstubAllGlobals();
  });

  it('does not initialize third-party login when local client IDs are absent', () => {
    environment.googleClientId = '';
    environment.discordClientId = '';
    component = TestBed.runInInjectionContext(() => new LoginComponent());
    component.ngAfterViewInit();
    expect(initialize).not.toHaveBeenCalled();
    component.loginWithDiscord();
    expect(component.errorMessage()).toContain('尚未設定 Discord OAuth');
  });

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

  it('waits for a new player to confirm a nickname before navigating to the safe return URL', () => {
    component.ngAfterViewInit(); initialize.mock.calls[0][0].callback({ credential: 'test-id-token' });
    response.next({ registrationRequired: true, registrationToken: 'pending-proof' });
    expect(openDialog.mock.calls[0][1].data).toEqual({ registrationToken: 'pending-proof' });
    expect(navigateByUrl).not.toHaveBeenCalled();
    confirmation.next({ token: 'app-token', tokenType: 'Bearer', user: { id: 'qa', email: 'qa@example.invalid', displayName: '自選暱稱' } });
    expect(navigateByUrl).toHaveBeenCalledWith('/characters/c/inventory');
    expect(component.isLoading()).toBe(false);
  });

  it('allows cancelling nickname registration and trying Google again', () => {
    component.ngAfterViewInit(); const callback = initialize.mock.calls[0][0].callback;
    callback({ credential: 'test-id-token' });
    response.next({ registrationRequired: true, registrationToken: 'pending-proof' });
    confirmation.next(undefined);
    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(component.isLoading()).toBe(false);
    callback({ credential: 'another-fixture' });
    expect(loginOAuth).toHaveBeenCalledTimes(2);
  });
});
