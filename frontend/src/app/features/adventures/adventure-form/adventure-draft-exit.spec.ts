import { TestBed } from '@angular/core/testing';
import { ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, Subject } from 'rxjs';
import { AdventureDraftSession } from '../../../core/services/adventure-draft-session';
import { AdventureService } from '../../../core/services/adventure.service';
import { InventoryService } from '../../../core/services/inventory.service';
import { AdventureFormComponent } from './adventure-form.component';

describe('Adventure draft exit choice', () => {
  let form: AdventureFormComponent;
  let draft: AdventureDraftSession;
  let choice: Subject<string | undefined>;
  const open = vi.fn();
  beforeEach(() => {
    choice = new Subject();
    open.mockReset().mockReturnValue({ afterClosed: () => choice, close: vi.fn() });
    TestBed.configureTestingModule({ providers: [AdventureDraftSession,
      { provide: ElementRef, useValue: { nativeElement: document.createElement('div') } },
      { provide: ActivatedRoute, useValue: {} }, { provide: Router, useValue: {} },
      { provide: MatSnackBar, useValue: {} }, { provide: MatDialog, useValue: { open } },
      { provide: AdventureService, useValue: {} }, { provide: InventoryService, useValue: {} },
    ] });
    draft = TestBed.inject(AdventureDraftSession);
    vi.spyOn(draft, 'isCurrentOwner').mockReturnValue(true);
    vi.spyOn(draft, 'hasChanges').mockReturnValue(true);
    vi.spyOn(draft, 'capture').mockImplementation(() => {});
    vi.spyOn(draft, 'flush').mockResolvedValue();
    form = TestBed.runInInjectionContext(() => new AdventureFormComponent());
    vi.spyOn(form as unknown as { recoverDraftText(): void }, 'recoverDraftText').mockImplementation(() => {});
  });
  it('leaves untouched or already saved forms directly, but blocks navigation during save', () => {
    vi.mocked(draft.hasChanges).mockReturnValue(false);
    expect(form.canLeave()).toBe(true);
    form['isSaving'].set(true);
    expect(form.canLeave()).toBe(false);
    form['cloudSaved'] = true;
    expect(form.canLeave()).toBe(true);
    expect(open).not.toHaveBeenCalled();
  });
  it.each(['continue', undefined])('keeps the page for continue or dismissal (%s)', async decision => {
    const leaving = form.canLeave();
    choice.next(decision);
    expect(await leaving).toBe(false);
    expect(draft.flush).not.toHaveBeenCalled();
  });
  it('shares one prompt for repeated navigation and confirms saved input before leaving', async () => {
    vi.spyOn(draft, 'isSaved').mockReturnValue(true);
    const first = form.canLeave();
    const second = form.canLeave();
    expect(first).toBe(second);
    choice.next('keep');
    expect(await first).toBe(true);
    expect(open).toHaveBeenCalledTimes(1);
    expect(draft.capture).toHaveBeenCalled();
    expect(draft.flush).toHaveBeenCalledTimes(1);
  });
  it('keeps input and opens recovery when preserving the draft failed', async () => {
    vi.spyOn(draft, 'isSaved').mockReturnValue(false);
    const leaving = form.canLeave();
    choice.next('keep');
    expect(await leaving).toBe(false);
    expect(form['leaveFailed']()).toBe(true);
    expect(form['recoverDraftText']).toHaveBeenCalled();
  });
  it('requires successful discard, and lets account changes leave without exposing old input', async () => {
    vi.spyOn(draft, 'discard').mockResolvedValue(false);
    const leaving = form.canLeave();
    choice.next('discard');
    expect(await leaving).toBe(false);
    expect(draft.discard).toHaveBeenCalledWith(true);
    vi.mocked(draft.isCurrentOwner).mockReturnValue(false);
    expect(form.canLeave()).toBe(true);
  });
});
