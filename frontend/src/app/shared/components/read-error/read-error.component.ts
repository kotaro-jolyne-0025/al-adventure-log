import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';

export function readErrorMessage(error: { status?: number }, subject: string): string {
  if (error.status === 404) return `找不到此${subject}，資料可能已移除。`;
  if (error.status === 403) return `沒有權限讀取此${subject}，請返回列表。`;
  if (error.status === 401) return '登入已失效，請重新登入。';
  return `無法載入${subject}，請確認連線後重試。`;
}

@Component({
  selector: 'app-read-error',
  imports: [MatButtonModule, RouterLink],
  template: `
    <section class="read-error" aria-label="讀取狀態">
      <p role="alert">{{ message() }}</p>
      <div class="read-error-actions">
        @if (retryable()) {
          <button mat-stroked-button type="button" [disabled]="pending()" (click)="retry.emit()">
            {{ pending() ? '正在重試…' : '重試' }}
          </button>
        }
        @if (returnTo()) {
          <a mat-button [routerLink]="returnTo()">返回列表</a>
        }
      </div>
    </section>
  `,
  styles: `
    :host { display: block; margin-block: 1rem; }
    .read-error { padding: 1rem; border: 1px solid var(--color-negative);
      border-radius: var(--radius-md); background: var(--color-negative-bg); }
    p { margin: 0 0 .5rem; color: var(--color-negative); overflow-wrap: anywhere; }
    .read-error-actions { display: flex; gap: .5rem; flex-wrap: wrap; }
  `,
})
export class ReadErrorComponent {
  readonly message = input.required<string>();
  readonly retryable = input(true);
  readonly pending = input(false);
  readonly returnTo = input<string | string[]>('');
  readonly retry = output<void>();
}
