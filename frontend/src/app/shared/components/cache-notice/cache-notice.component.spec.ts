import { TestBed } from '@angular/core/testing';
import { CacheNoticeComponent } from './cache-notice.component';

describe('CacheNoticeComponent', () => {
  it('hides the cached-data notice while cloud refresh is pending', () => {
    const fixture = TestBed.createComponent(CacheNoticeComponent);
    fixture.componentRef.setInput('source', 'copy');
    fixture.componentRef.setInput('pending', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.notice')).toBeNull();

    fixture.componentRef.setInput('hasContent', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent).toContain('正在更新資料');
    expect(fixture.nativeElement.querySelector('button')).toBeNull();

    fixture.componentRef.setInput('pending', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.notice')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.updating')).toBeNull();
  });
});
