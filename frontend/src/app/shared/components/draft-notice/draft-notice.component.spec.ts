import { TestBed } from '@angular/core/testing';
import { DraftNoticeComponent } from './draft-notice.component';

describe('DraftNoticeComponent', () => {
  it('keeps the draft preview hidden when local saving fails', () => {
    const fixture = TestBed.createComponent(DraftNoticeComponent);
    fixture.componentRef.setInput('text', '目前表單內容');
    fixture.componentRef.setInput('error', '裝置空間不足，草稿未能暫存。');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.preview')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('複製草稿');
    expect(fixture.nativeElement.textContent).toContain('裝置空間不足');
    expect(fixture.nativeElement.querySelector('button')).not.toBeNull();
  });
});
