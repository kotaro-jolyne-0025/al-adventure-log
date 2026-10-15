import { Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-draft-notice',
  standalone: true,
  imports: [DatePipe, MatButtonModule],
  template: ` @if (offered()) {
      <section class="notice" aria-label="未完成的草稿">
        <p>這台裝置有一份草稿，上次保存：{{ savedAt() | date: 'yyyy/MM/dd HH:mm' }}。</p>
        <div class="actions">
          <button type="button" mat-flat-button [disabled]="pending() || !canRestore()" (click)="restore.emit()">
            繼續填寫
          </button>
          <button type="button" mat-button [disabled]="pending()" (click)="recover.emit()">查看草稿</button>
          <button type="button" mat-button [disabled]="pending()" (click)="discard.emit()">
            {{ pending() ? '正在捨棄…' : '捨棄草稿' }}
          </button>
        </div>
      </section>
    }
    @if (status()) {
      <p class="status" role="status">
        {{ status() }}
        @if (savedAt()) {
          <span>（{{ savedAt() | date: 'HH:mm' }}）</span>
        }
      </p>
    }
    @if (error()) {
      <div class="error" role="alert">
        <p>{{ error() }}</p>
        <div class="actions">
          @if (retryable()) { <button type="button" mat-button (click)="retry.emit()">再試一次</button> }
        </div>
      </div>
    }
    @if (text() && !error()) {
      <section class="preview" aria-label="冒險草稿內容">
        <header>
          <h2>冒險紀錄草稿</h2>
          <span>尚未送出</span>
        </header>
        <pre>{{ text() }}</pre>
      </section>
    }`,
  styles: [
    `
      :host {
        display: block;
        margin-block: 1rem;
      }
      p {
        margin: 0.5rem 0;
        overflow-wrap: anywhere;
        line-height: 1.6;
      }
      .notice {
        border: 1px solid var(--mat-sys-outline-variant);
        border-radius: 12px;
        padding: 1rem;
      }
      .status {
        color: var(--mat-sys-on-surface-variant);
      }
      .error {
        color: var(--mat-sys-on-error-container);
        background: var(--mat-sys-error-container);
        padding: 1rem;
        border-radius: 12px;
      }
      .preview {
        margin-top: 1rem;
      }
      .preview header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
      }
      .preview h2 {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
      }
      .preview header span {
        flex: none;
        padding: 0.2rem 0.6rem;
        border-radius: 999px;
        color: var(--mat-sys-on-surface-variant);
        background: var(--mat-sys-surface-container-high);
        font-size: 0.75rem;
      }
      .preview pre {
        max-height: 22rem;
        overflow: auto;
        margin: 0.5rem 0 0;
        color: var(--mat-sys-on-surface);
        font: inherit;
        line-height: 1.65;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
      }
      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
      button {
        min-height: 44px;
        height: auto;
        white-space: normal;
      }
    `,
  ],
})
export class DraftNoticeComponent {
  offered = input(false);
  savedAt = input<number | null>(null);
  canRestore = input(false);
  status = input('');
  error = input<string | null>(null);
  retryable = input(true);
  pending = input(false);
  text = input('');
  restore = output<void>();
  discard = output<void>();
  recover = output<void>();
  retry = output<void>();
}
