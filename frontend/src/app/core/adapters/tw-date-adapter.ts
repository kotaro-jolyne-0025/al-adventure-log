import { Injectable } from '@angular/core';
import { NativeDateAdapter } from '@angular/material/core';

/**
 * 自訂 DateAdapter，覆寫 getDateNames() 以移除 zh-Hant locale 下
 * Intl.DateTimeFormat 產生的「日」後綴，使日曆格內只顯示純數字。
 */
@Injectable()
export class TwDateAdapter extends NativeDateAdapter {
  override getDateNames(): string[] {
    return Array.from({ length: 31 }, (_, i) => String(i + 1));
  }
}
