import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { AuthService } from '../../../core/services/auth.service';
import { AuthResponse } from '../../../core/models/auth.model';
import { OAuthRegisterDialogComponent } from './oauth-register-dialog.component';

describe('OAuth nickname confirmation', () => {
  const account: AuthResponse = { token: 'app-token', tokenType: 'Bearer', user: { id: 'qa', email: 'qa@example.invalid', displayName: '自選暱稱' } };
  let response: Subject<AuthResponse>;
  let registerOAuth: ReturnType<typeof vi.fn>;
  let dialog: { close: ReturnType<typeof vi.fn>; disableClose: boolean };

  beforeEach(() => {
    response = new Subject(); registerOAuth = vi.fn(() => response);
    dialog = { close: vi.fn(), disableClose: false };
    TestBed.configureTestingModule({ providers: [
      { provide: AuthService, useValue: { registerOAuth } },
      { provide: MAT_DIALOG_DATA, useValue: { registrationToken: 'pending-proof' } },
      { provide: MatDialogRef, useValue: dialog },
    ] });
  });

  it('starts empty, rejects blank or long names and supports form submission from the keyboard', () => {
    const fixture = TestBed.createComponent(OAuthRegisterDialogComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const input: HTMLInputElement = fixture.nativeElement.querySelector('input');
    expect(input.value).toBe('');
    expect(input.autocomplete).toBe('off');
    expect(fixture.nativeElement.textContent).toContain('請避免使用真實姓名');
    for (const invalid of ['', '   ', 'x'.repeat(101)]) {
      component.form.controls.displayName.setValue(invalid);
      component.onSubmit();
    }
    expect(registerOAuth).not.toHaveBeenCalled();
    component.form.controls.displayName.setValue('  自選暱稱  ');
    fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    component.onSubmit();
    expect(registerOAuth).toHaveBeenCalledExactlyOnceWith('pending-proof', '自選暱稱');
    expect(dialog.disableClose).toBe(true);
    component.cancel();
    expect(dialog.close).not.toHaveBeenCalled();
    response.next(account);
    expect(dialog.close).toHaveBeenCalledWith(account);
  });

  it.each([409, 410, 503])('keeps the chosen nickname after status %s and offers the appropriate recovery', status => {
    const fixture = TestBed.createComponent(OAuthRegisterDialogComponent);
    const component = fixture.componentInstance;
    component.form.controls.displayName.setValue('自選暱稱');
    component.onSubmit();
    response.error({ status, error: { message: '請重新登入或稍後重試' } });
    fixture.detectChanges();
    expect(component.form.controls.displayName.value).toBe('自選暱稱');
    expect(component.isLoading()).toBe(false);
    expect(component.restartRequired()).toBe(status !== 503);
    expect(dialog.disableClose).toBe(false);
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('請重新登入');
    component.cancel();
    expect(dialog.close).toHaveBeenCalledWith();
  });

  it('cancels without registering or storing the pending proof', () => {
    const component = TestBed.runInInjectionContext(() => new OAuthRegisterDialogComponent());
    const setLocal = vi.spyOn(Storage.prototype, 'setItem');
    component.cancel();
    expect(registerOAuth).not.toHaveBeenCalled();
    expect(dialog.close).toHaveBeenCalledWith();
    expect(setLocal).not.toHaveBeenCalled();
    setLocal.mockRestore();
  });
});
