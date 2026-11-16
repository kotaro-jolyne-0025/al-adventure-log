import { Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';

@Component({
  selector: 'app-cache-notice',
  standalone: true,
  imports: [DatePipe],
  template: `@if (source() === 'copy' && !pending()) {
    <p class="notice">上次更新：<time [attr.datetime]="fetchedAt() | date:'yyyy-MM-ddTHH:mm:ssZZZZZ'">{{ fetchedAt() | date:'yyyy/MM/dd HH:mm' }}</time></p>
  }`,
  styles: [
    `
      :host {
        display: block;
      }
      .notice {
        margin-block: 0.5rem;
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.875rem;
        overflow-wrap: anywhere;
      }
    `,
  ],
})
export class CacheNoticeComponent {
  source = input<'cloud' | 'copy' | null>(null);
  fetchedAt = input<number | null>(null);
  pending = input(false);
}
