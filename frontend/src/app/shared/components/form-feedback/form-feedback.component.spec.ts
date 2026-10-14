import { TestBed } from '@angular/core/testing';
import { FormFeedbackComponent } from './form-feedback.component';

describe('Conflict feedback', () => {
  it('opens the new version in another tab while keeping the editing page', async () => {
    const fixture = TestBed.createComponent(FormFeedbackComponent);
    fixture.componentRef.setInput('message', '資料已更新，輸入仍保留');
    fixture.componentRef.setInput('viewUrl', '/characters/c/adventures/e');
    fixture.componentRef.setInput('target', '');
    await fixture.whenStable();
    const link = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(link.textContent).toContain('查看新版');
    expect(link.getAttribute('href')).toBe('/characters/c/adventures/e');
    expect(link.target).toBe('_blank');
    expect(link.rel).toBe('noopener');
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('輸入仍保留');
  });
});
