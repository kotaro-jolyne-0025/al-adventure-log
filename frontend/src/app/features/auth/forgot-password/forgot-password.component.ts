import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-forgot-password',
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
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);

  readonly isLoading = signal(false);
  readonly isSubmitted = signal(false);
  readonly submittedEmail = signal('');
  readonly errorMessage = signal<string | null>(null);

  readonly forgotForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  onSubmit(): void {
    if (this.forgotForm.invalid || this.isLoading()) return;

    const email = this.forgotForm.value.email.trim();
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authService.forgotPassword(email).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        this.submittedEmail.set(email);
        this.isSubmitted.set(true);
        this.snackBar.open('重設密碼請求已送出！', '關閉', { duration: 4000 });
      },
      error: (err) => {
        this.isLoading.set(false);
        const msg = err.error?.message || '發送失敗，請稍後再試';
        this.errorMessage.set(msg);
        this.snackBar.open(msg, '關閉', { duration: 4000 });
      },
    });
  }
}
