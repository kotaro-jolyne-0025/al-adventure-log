import { Component, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';

@Component({
  selector: 'app-draft-notice',
  standalone: true,
  imports: [DatePipe, MatButtonModule, MatInputModule, MatFormFieldModule],
  template: ` @if (offered()) {
      <section class="notice" aria-label="本機草稿">
        <p>此裝置有未完成草稿，保存時間：{{ savedAt() | date: 'yyyy/MM/dd HH:mm' }}。</p>
        <p>
          {{
            completed()
              ? '此草稿已儲存至雲端。請先查看雲端紀錄，再捨棄本機草稿。'
              : canRestore()
                ? '可恢復草稿並繼續填寫。'
                : '尚未確認最新雲端資料、內容已變更或格式不相容。可先取回草稿文字，連線重新取得完整資料後再確認。'
          }}
        </p>
        <div class="actions">
          <button type="button" mat-flat-button [disabled]="!canRestore()" (click)="restore.emit()">
            恢復草稿
          </button>
          <button type="button" mat-button (click)="recover.emit()">取回文字</button>
          <button type="button" mat-button (click)="discard.emit()">捨棄草稿</button>
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
          <button type="button" mat-button (click)="retry.emit()">重試保存草稿</button>
          <button type="button" mat-button (click)="recover.emit()">取回文字</button>
        </div>
      </div>
    }
    @if (text()) {
      <mat-form-field appearance="outline" class="text"
        ><mat-label>草稿文字（可選取複製）</mat-label>
        <textarea
          matInput
          readonly
          rows="8"
          [value]="text()"
          (focus)="selectText($event)"
        ></textarea>
      </mat-form-field>
      <button type="button" mat-button (click)="copy()">複製草稿文字</button>
      @if (copyStatus()) {
        <p role="status">{{ copyStatus() }}</p>
      }
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
      .text {
        display: block;
        margin-top: 1rem;
        width: 100%;
      }
      textarea {
        font-size: 16px;
      }
    `,
  ],
})
export class DraftNoticeComponent {
  offered = input(false);
  savedAt = input<number | null>(null);
  canRestore = input(false);
  completed = input(false);
  status = input('');
  error = input<string | null>(null);
  text = input('');
  restore = output<void>();
  discard = output<void>();
  recover = output<void>();
  retry = output<void>();
  protected readonly copyStatus = signal('');
  protected selectText(event: FocusEvent): void {
    (event.target as HTMLTextAreaElement).select();
  }
  protected async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.text());
      this.copyStatus.set('草稿文字已複製。');
    } catch {
      this.copyStatus.set('請選取上方文字並使用裝置的複製功能。');
    }
  }
}
