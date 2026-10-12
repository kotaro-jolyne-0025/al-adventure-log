import { Component, input, output } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';

@Component({
  selector: 'app-cache-notice',
  standalone: true,
  imports: [DatePipe, MatButtonModule],
  template: ` @if (source() === 'copy' || showRefresh()) { <div class="notice">
    @if (source() === 'copy') {
      <p role="status">
        {{ compact() ? '角色摘要為本機副本' : '正在顯示本機副本' }}，取得時間：{{ fetchedAt() | date: 'yyyy/MM/dd HH:mm' }}。
        @if (!compact()) { 修改、刪除及使用物品需連線取得最新資料。 }
      </p>
    }
    <button type="button" mat-button [disabled]="pending()" (click)="refresh.emit()">
      {{ pending() ? '正在取得資料…' : '重新取得資料' }}
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
  showRefresh = input(true);
  refresh = output<void>();
}
