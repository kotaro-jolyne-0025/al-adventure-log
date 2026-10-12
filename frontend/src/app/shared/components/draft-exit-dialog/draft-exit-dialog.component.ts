import { Component, inject } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';

export type DraftExitChoice = 'keep' | 'discard' | 'continue';

@Component({
  selector: 'app-draft-exit-dialog',
  imports: [A11yModule, MatButtonModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>離開前要保留草稿嗎？</h2>
    <mat-dialog-actions>
      <button mat-stroked-button cdkFocusInitial (click)="close('continue')">繼續填寫</button>
      <button mat-flat-button (click)="close('keep')">保留草稿並離開</button>
      <button mat-button class="discard" (click)="close('discard')">捨棄草稿並離開</button>
    </mat-dialog-actions>
  `,
  styles: `
    @use '@angular/material' as mat;
    p { overflow-wrap: anywhere; }
    mat-dialog-actions { display: flex; flex-direction: column; align-items: stretch;
      gap: .5rem; padding: .75rem 1.5rem 1.25rem; }
    button { height: auto; min-height: 44px; padding-block: .5rem; white-space: normal; }
    @media (max-width: 360px) {
      mat-dialog-actions { padding-inline: 8px; }
      mat-dialog-actions button { padding-inline: 8px; }
    }
    .discard { @include mat.button-overrides((text-label-text-color: var(--mat-sys-error))); }
  `,
})
export class DraftExitDialogComponent {
  private readonly dialog = inject(MatDialogRef<DraftExitDialogComponent, DraftExitChoice>);
  protected close(choice: DraftExitChoice): void { this.dialog.close(choice); }
}
