import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { A11yModule } from '@angular/cdk/a11y';
import { MatButtonModule } from '@angular/material/button';

export interface ConfirmDialogData {
  title: string;
  intent?: 'general' | 'destructive';
  message: string;
  confirmText?: string;
  cancelText?: string;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, A11yModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content>
      <p>{{ data.message }}</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end" class="dialog-actions">
      <button mat-button cdkFocusInitial (click)="onCancel()">
        {{ data.cancelText ?? '取消' }}
      </button>
      <button mat-flat-button [class.destructive-confirm]="data.intent === 'destructive'" (click)="onConfirm()">
        {{ data.confirmText ?? '確認刪除' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    @use '@angular/material' as mat;
    .destructive-confirm {
      @include mat.button-overrides((filled-container-color: var(--mat-sys-error), filled-label-text-color: var(--mat-sys-on-error)));
    }
    mat-dialog-content p {
      white-space: pre-line;
      overflow-wrap: anywhere;
    }

    .dialog-actions {
      padding: 0.75rem 1.5rem 1.25rem;
      gap: 0.5rem;

      @media (max-width: 480px) {
        padding: 0.5rem 0.75rem 1rem;

        button {
          flex: 1;
          min-height: 44px;
        }
      }
    }
  `],
})
export class ConfirmDialogComponent {
  protected readonly data: ConfirmDialogData = inject(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<ConfirmDialogComponent>);

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}
