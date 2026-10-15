import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/services/auth.service';
import { AuthResponse } from '../../../core/models/auth.model';

@Component({
  selector: 'app-oauth-register-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatProgressSpinner],
  template: `
    <h2 mat-dialog-title>設定玩家顯示名稱</h2>
    <form [formGroup]="form" (ngSubmit)="onSubmit()" [attr.aria-busy]="isLoading()">
      <mat-dialog-content>
        <p>這是你在冒險紀錄表使用的名稱，請避免使用真實姓名。</p>
        <mat-form-field appearance="outline">
          <mat-label>玩家顯示名稱</mat-label>
          <input matInput formControlName="displayName" autocomplete="off" maxlength="100" />
          <mat-hint>確認後才會建立帳號，之後仍可修改名稱。</mat-hint>
          @if (form.controls.displayName.hasError('required') || form.controls.displayName.hasError('pattern')) {
            <mat-error>請輸入非空白的名稱</mat-error>
          }
          @if (form.controls.displayName.hasError('maxlength')) {
            <mat-error>名稱最多 100 字元</mat-error>
          }
        </mat-form-field>
        @if (errorMessage()) {
          <p class="form-error" role="alert">{{ errorMessage() }}</p>
        }
        <p class="legal-hint">點擊「確認註冊」即表示已閱讀並同意
          <a href="/legal" target="_blank" rel="noopener">版權與免責聲明</a>。
        </p>
        <p class="sr-only" role="status">{{ isLoading() ? '正在建立帳號，請稍候。' : '' }}</p>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" (click)="cancel()" [disabled]="isLoading()">
          {{ restartRequired() ? '返回登入' : '取消' }}
        </button>
        <button mat-flat-button type="submit" [disabled]="form.invalid || isLoading() || restartRequired()">
          @if (isLoading()) { <mat-spinner diameter="18" aria-hidden="true" /> }
          {{ isLoading() ? '註冊中…' : '確認註冊' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    mat-form-field { width: 100%; margin-top: 0.5rem; }
    mat-dialog-content p { line-height: 1.6; }
    .legal-hint { font-size: 0.875rem; margin-top: 1.5rem; }
    a { color: var(--mat-sys-primary); }
    .form-error { color: var(--mat-sys-error); }
    mat-dialog-actions { gap: 0.5rem; padding: 1rem 1.5rem; flex-wrap: wrap; }
    mat-dialog-actions button { min-height: 48px; }
    mat-spinner { display: inline-block; margin-inline-end: 0.5rem; vertical-align: middle; }
  `,
})
export class OAuthRegisterDialogComponent {
  private readonly auth = inject(AuthService);
  private readonly dialogRef = inject(MatDialogRef<OAuthRegisterDialogComponent, AuthResponse>);
  private readonly data: { registrationToken: string } = inject(MAT_DIALOG_DATA);
  private readonly destroyRef = inject(DestroyRef);

  readonly form = inject(FormBuilder).nonNullable.group({
    displayName: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(100)]],
  });
  readonly isLoading = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly restartRequired = signal(false);

  cancel(): void {
    if (!this.isLoading()) this.dialogRef.close();
  }

  onSubmit(): void {
    if (this.form.invalid || this.isLoading() || this.restartRequired()) return;
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.dialogRef.disableClose = true;
    this.auth.registerOAuth(this.data.registrationToken, this.form.controls.displayName.value.trim())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: response => this.dialogRef.close(response),
        error: err => {
          this.isLoading.set(false);
          this.dialogRef.disableClose = false;
          this.restartRequired.set(err.status === 410 || err.status === 409);
          this.errorMessage.set(err.error?.message || '註冊未完成，請稍後重試。');
        },
      });
  }
}
