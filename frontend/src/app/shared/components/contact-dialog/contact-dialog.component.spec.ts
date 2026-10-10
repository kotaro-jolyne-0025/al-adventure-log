import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ContactDialogComponent } from './contact-dialog.component';
import { siteLinks } from '../../../core/config/site-links';

describe('ContactDialogComponent', () => {
  const openSnack = vi.fn();
  beforeEach(() => {
    openSnack.mockClear();
    TestBed.configureTestingModule({
      imports: [ContactDialogComponent],
      providers: [{ provide: MatSnackBar, useValue: { open: openSnack } }],
    });
  });

  afterEach(() => {
    TestBed.inject(MatDialog).closeAll();
    vi.unstubAllGlobals();
  });

  it('opens a named dialog with only the public alias and fixed subject in its mail link', () => {
    const ref = TestBed.inject(MatDialog).open(ContactDialogComponent);
    const component = ref.componentInstance;
    const link = new URL(component.mailto);
    expect(link.pathname).toBe(siteLinks.contactEmail);
    expect([...link.searchParams.keys()]).toEqual(['subject']);
    expect(link.searchParams.get('subject')).toBe('冒險紀錄表 Web版｜使用問題');
  });

  it.each(['success', 'denied', 'unavailable'])('reports clipboard %s honestly', async state => {
    const writeText = state === 'success' ? vi.fn().mockResolvedValue(undefined) : vi.fn().mockRejectedValue(new Error('denied'));
    vi.stubGlobal('navigator', state === 'unavailable' ? {} : { clipboard: { writeText } });
    const ref = TestBed.inject(MatDialog).open(ContactDialogComponent);
    await ref.componentInstance.copyEmail();
    expect(openSnack).toHaveBeenCalledWith(
      state === 'success' ? '已複製信箱' : '無法自動複製，請選取信箱手動複製', '關閉', expect.any(Object),
    );
    if (state !== 'unavailable') expect(writeText).toHaveBeenCalledWith(siteLinks.contactEmail);
  });
});
