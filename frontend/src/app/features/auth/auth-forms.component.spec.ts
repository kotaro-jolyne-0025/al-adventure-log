import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { RegisterComponent } from './register/register.component';
import { LoginComponent } from './login/login.component';
import { ForgotPasswordComponent } from './forgot-password/forgot-password.component';
import { ResetPasswordComponent } from './reset-password/reset-password.component';

describe('Email and password forms', () => {
  const credentials = { email: 'player@example.invalid', password: 'synthetic-password', displayName: '本站暱稱' };
  let response: Subject<any>;
  let verification: Subject<{ valid: boolean }>;
  let auth: Record<string, ReturnType<typeof vi.fn>>;
  let router: { navigate: ReturnType<typeof vi.fn>; navigateByUrl: ReturnType<typeof vi.fn> };
  let queryParams: Record<string, string>;

  beforeEach(() => {
    response = new Subject(); verification = new Subject();
    auth = Object.fromEntries(['register', 'login', 'forgotPassword', 'resetPassword'].map(method => [method, vi.fn(() => response)]));
    auth['verifyResetToken'] = vi.fn(() => verification);
    router = { navigate: vi.fn(), navigateByUrl: vi.fn() }; queryParams = { token: 'reset-fixture' };
    TestBed.configureTestingModule({ providers: [
      { provide: AuthService, useValue: auth },
      { provide: Router, useValue: router },
      { provide: ActivatedRoute, useValue: { snapshot: { queryParams } } },
      { provide: MatSnackBar, useValue: { open: vi.fn() } },
      { provide: MatDialog, useValue: { open: vi.fn() } },
    ] });
  });
  afterEach(() => vi.useRealTimers());

  it('registers valid credentials once and keeps inputs on duplicate-email or network errors', () => {
    const component = TestBed.runInInjectionContext(() => new RegisterComponent());
    for (const invalid of [
      { ...credentials, email: 'invalid' }, { ...credentials, password: 'short' },
      { ...credentials, displayName: '   ' }, { ...credentials, displayName: 'x'.repeat(101) },
    ]) {
      component.registerForm.setValue(invalid); component.onSubmit();
    }
    expect(auth['register']).not.toHaveBeenCalled();
    component.registerForm.setValue(credentials); component.onSubmit(); component.onSubmit();
    expect(auth['register']).toHaveBeenCalledExactlyOnceWith(credentials);
    response.error({ error: { message: '此 Email 已經註冊過，請直接登入' } });
    expect(component.registerForm.value).toEqual(credentials);
    expect(component.errorMessage()).toContain('已經註冊');
    expect(component.isLoading()).toBe(false);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('navigates a newly registered account to characters', () => {
    const component = TestBed.runInInjectionContext(() => new RegisterComponent());
    component.registerForm.setValue(credentials); component.onSubmit();
    response.next({ user: { displayName: credentials.displayName } });
    expect(router.navigate).toHaveBeenCalledWith(['/characters']);
  });

  it('logs in by email and password and preserves the form when authentication fails', () => {
    const component = TestBed.runInInjectionContext(() => new LoginComponent());
    component.loginForm.setValue({ email: credentials.email, password: credentials.password });
    component.onSubmit(); component.onSubmit();
    expect(auth['login']).toHaveBeenCalledTimes(1);
    response.error({ error: { message: '帳號或密碼錯誤' } });
    expect(component.errorMessage()).toBe('帳號或密碼錯誤');
    expect(component.loginForm.value.password).toBe(credentials.password);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('navigates after a successful password login', () => {
    queryParams['returnUrl'] = '/characters';
    const component = TestBed.runInInjectionContext(() => new LoginComponent());
    component.loginForm.setValue({ email: credentials.email, password: credentials.password }); component.onSubmit();
    response.next({ user: { displayName: credentials.displayName } });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/characters');
  });

  it('handles a generic forgot-password success and a recoverable SMTP request error', () => {
    const component = TestBed.runInInjectionContext(() => new ForgotPasswordComponent());
    component.forgotForm.setValue({ email: 'invalid' }); component.onSubmit();
    expect(auth['forgotPassword']).not.toHaveBeenCalled();
    component.forgotForm.setValue({ email: credentials.email }); component.onSubmit(); component.onSubmit();
    response.error({ error: { message: '稍後再試' } });
    expect(component.errorMessage()).toBe('稍後再試');
    expect(component.forgotForm.value.email).toBe(credentials.email);
    response = new Subject(); component.onSubmit();
    response.next({ message: '若帳號存在，會寄送重設信' });
    expect(component.isSubmitted()).toBe(true);
    expect(component.submittedEmail()).toBe(credentials.email);
  });

  it('requires a valid reset link and matching long passwords, then returns to login', () => {
    vi.useFakeTimers();
    const component = TestBed.runInInjectionContext(() => new ResetPasswordComponent());
    component.ngOnInit();
    component.resetForm.setValue({ newPassword: 'new-synthetic-password', confirmPassword: 'new-synthetic-password' });
    component.onSubmit(); expect(auth['resetPassword']).not.toHaveBeenCalled();
    verification.next({ valid: true });
    component.resetForm.controls['confirmPassword'].setValue('different'); component.onSubmit();
    expect(auth['resetPassword']).not.toHaveBeenCalled();
    component.resetForm.controls['confirmPassword'].setValue('new-synthetic-password');
    component.onSubmit(); component.onSubmit();
    expect(auth['resetPassword']).toHaveBeenCalledExactlyOnceWith('reset-fixture', 'new-synthetic-password');
    response.next({ message: 'success' });
    expect(component.isSuccess()).toBe(true);
    component.onSubmit(); expect(auth['resetPassword']).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2000);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });

  it.each(['missing', 'expired'])('blocks reset with a %s link', state => {
    if (state === 'missing') delete queryParams['token'];
    const component = TestBed.runInInjectionContext(() => new ResetPasswordComponent());
    component.ngOnInit();
    if (state === 'expired') verification.error({ error: { message: '連結已過期' } });
    component.resetForm.setValue({ newPassword: 'new-synthetic-password', confirmPassword: 'new-synthetic-password' });
    component.onSubmit();
    expect(auth['resetPassword']).not.toHaveBeenCalled();
    expect(component.isTokenValid()).toBe(false);
    expect(component.errorMessage()).toBeTruthy();
  });
});
