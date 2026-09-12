import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth.service';

export const passwordMatchValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const newPassword = control.get('newPassword')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  if (newPassword && confirmPassword && newPassword !== confirmPassword) {
    return { passwordMismatch: true };
  }
  return null;
};

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);

  readonly token = signal<string | null>(null);
  readonly hideNewPassword = signal(true);
  readonly hideConfirmPassword = signal(true);
  readonly isLoading = signal(false);
  readonly isSuccess = signal(false);
  readonly isCheckingToken = signal(true);
  readonly isTokenValid = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly resetForm: FormGroup = this.fb.group(
    {
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordMatchValidator }
  );

  ngOnInit(): void {
    const tokenParam = this.route.snapshot.queryParams['token'];
    if (tokenParam) {
      this.token.set(tokenParam);
      this.isCheckingToken.set(true);
      this.authService.verifyResetToken(tokenParam).subscribe({
        next: () => {
          this.isCheckingToken.set(false);
          this.isTokenValid.set(true);
        },
        error: (err) => {
          this.isCheckingToken.set(false);
          this.isTokenValid.set(false);
          const msg = err.error?.message || '此重設密碼連結已失效、已被使用過或已過期';
          this.errorMessage.set(msg);
        },
      });
    } else {
      this.isCheckingToken.set(false);
      this.isTokenValid.set(false);
      this.errorMessage.set('缺少重設驗證憑證 Token，請確認連結是否正確或重新由登入頁申請');
    }
  }

  onSubmit(): void {
    if (this.resetForm.invalid || this.isLoading() || !this.token()) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const newPassword = this.resetForm.value.newPassword;

    this.authService.resetPassword(this.token()!, newPassword).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.isSuccess.set(true);
        this.snackBar.open('密碼重設成功！即將前往登入頁面...', '關閉', { duration: 4000 });
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 2000);
      },
      error: (err) => {
        this.isLoading.set(false);
        const msg = err.error?.message || '密碼重設失敗，連結可能已過期或已被使用';
        this.errorMessage.set(msg);
        this.snackBar.open(msg, '關閉', { duration: 4000 });
      },
    });
  }
}
