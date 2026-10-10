import { Component, inject } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar } from '@angular/material/snack-bar';
import { siteLinks } from '../../../core/config/site-links';

@Component({
  selector: 'app-contact-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>聯絡我</h2>
    <mat-dialog-content>
      <p>遇到使用問題或想提供建議，歡迎寄信給我。</p>
      <p class="contact-address">{{ email }}</p>
      <p class="contact-help">請描述操作步驟、遇到的問題及使用裝置；需要時可附截圖。</p>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <a mat-stroked-button [href]="mailto">寄信給我</a>
      <button mat-button type="button" (click)="copyEmail()">複製信箱</button>
      <button mat-button type="button" mat-dialog-close>關閉</button>
    </mat-dialog-actions>
  `,
  styles: [`
    mat-dialog-content { color: var(--mat-sys-on-surface); }
    p { overflow-wrap: anywhere; }
    .contact-address { font-weight: 500; user-select: text; }
    .contact-help { color: var(--mat-sys-on-surface-variant); }
    mat-dialog-actions { gap: 0.5rem; padding: 0.75rem 1.5rem 1.25rem; flex-wrap: wrap; }
    mat-dialog-actions a, mat-dialog-actions button { min-height: 44px; height: auto; white-space: normal; }
    @media (max-width: 480px) {
      mat-dialog-actions { padding: 0.75rem; }
    }
  `],
})
export class ContactDialogComponent {
  readonly email = siteLinks.contactEmail;
  readonly mailto = `mailto:${this.email}?subject=${encodeURIComponent('冒險紀錄表 Web版｜使用問題')}`;
  private readonly snackBar = inject(MatSnackBar);

  async copyEmail(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.email);
      this.snackBar.open('已複製信箱', '關閉', { duration: 3000 });
    } catch {
      this.snackBar.open('無法自動複製，請選取信箱手動複製', '關閉', { duration: 6000 });
    }
  }
}
