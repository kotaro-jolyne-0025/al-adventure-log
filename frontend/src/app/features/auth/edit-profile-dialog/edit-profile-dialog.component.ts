import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth.service';
import { User } from '../../../core/models/auth.model';

@Component({
  selector: 'app-edit-profile-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <h2 mat-dialog-title class="dialog-title">
      <mat-icon color="primary">edit</mat-icon>
      修改玩家顯示名稱
    </h2>

    <mat-dialog-content class="dialog-content">
      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>玩家顯示名稱</mat-label>
          <input matInput formControlName="displayName" placeholder="請輸入新的暱稱" autocomplete="off" />
          <mat-icon matPrefix>badge</mat-icon>
          <mat-error *ngIf="form.get('displayName')?.hasError('required')">顯示名稱不能為空</mat-error>
          <mat-error *ngIf="form.get('displayName')?.hasError('maxlength')">名稱不能超過 100 字</mat-error>
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end" class="dialog-actions">
      <button mat-button mat-dialog-close [disabled]="isLoading()">取消</button>
      <button mat-raised-button color="primary" (click)="onSubmit()" [disabled]="form.invalid || isLoading()">
        <mat-spinner *ngIf="isLoading()" diameter="18" class="spinner"></mat-spinner>
        <span *ngIf="!isLoading()">儲存修改</span>
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-title {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 1.25rem;
      margin-bottom: 0.5rem;
    }
    .dialog-content {
      width: 100%;
      max-width: 400px;
      box-sizing: border-box;
      padding-top: 1rem !important;
    }
    .full-width {
      width: 100%;
    }
    .dialog-actions {
      padding: 1rem 1.5rem;
      gap: 0.5rem;

      @media (max-width: 480px) {
        padding: 0.75rem 1rem;

        button {
          flex: 1;
          height: 42px;
        }
      }
    }
    .spinner {
      display: inline-block;
      margin-right: 6px;
    }
  `],
})
export class EditProfileDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<EditProfileDialogComponent>);
  private readonly authService = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  public readonly data: { user: User } = inject(MAT_DIALOG_DATA);

  readonly isLoading = signal(false);

  readonly form: FormGroup = this.fb.group({
    displayName: [this.data.user.displayName || '', [Validators.required, Validators.maxLength(100)]],
  });

  onSubmit(): void {
    if (this.form.invalid || this.isLoading()) return;

    this.isLoading.set(true);
    const newName = this.form.value.displayName.trim();

    this.authService.updateProfile(newName, this.data.user.avatarUrl).subscribe({
      next: (updatedUser) => {
        this.isLoading.set(false);
        this.snackBar.open(`顯示名稱已更新為「${updatedUser.displayName}」！`, '關閉', { duration: 3000 });
        this.dialogRef.close(updatedUser);
      },
      error: (err) => {
        this.isLoading.set(false);
        const msg = err.error?.message || '更新失敗，請稍後再試';
        this.snackBar.open(msg, '關閉', { duration: 4000 });
      },
    });
  }
}
