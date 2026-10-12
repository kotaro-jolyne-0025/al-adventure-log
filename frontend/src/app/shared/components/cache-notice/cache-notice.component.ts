import { Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-cache-notice',
  standalone: true,
  imports: [DatePipe, MatButtonModule],
  template: ` @if (source() === 'copy') { <div class="notice">
      <p role="status">
        {{ compact() ? '目前顯示上次查看的角色資訊' : '目前顯示上次查看的資料' }}，上次更新：{{ fetchedAt() | date: 'yyyy/MM/dd HH:mm' }}。
        連線更新後才能修改資料。
      </p>
    <button type="button" mat-button [disabled]="pending()" (click)="refresh.emit()">
      {{ pending() ? '正在更新…' : '更新資料' }}
    </button>
  </div> }`,
  styles: [
    `
      :host {
        display: block;
      }
      .notice {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-block: 0.5rem 1rem;
      }
      p {
        flex: 1 1 16rem;
        margin: 0;
        color: var(--mat-sys-on-surface-variant);
        overflow-wrap: anywhere;
        line-height: 1.6;
      }
      button {
        min-height: 44px;
        white-space: normal;
        height: auto;
      }
    `,
  ],
})
export class CacheNoticeComponent {
  source = input<'cloud' | 'copy' | null>(null);
  fetchedAt = input<number | null>(null);
  pending = input(false);
  compact = input(false);
  refresh = output<void>();
}
