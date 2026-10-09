import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, Subject, throwError } from 'rxjs';
import { CharacterService } from '../../../core/services/character.service';
import { AuthService } from '../../../core/services/auth.service';
import { CharacterFormComponent } from './character-form.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';

describe('CharacterFormComponent opening baseline edit', () => {
  const character = {
    id: 'c', characterName: 'Hero', race: 'Human', initialClassesString: 'Fighter5',
    currentClassesString: 'Fighter5', initialGold: 10, currentGold: 10,
    initialDowntime: 2, currentDowntime: 2, hasAdventureEntries: true,
  };
  let component: CharacterFormComponent;
  let api: { getById: ReturnType<typeof vi.fn>; previewOpeningBaseline: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  let navigate: ReturnType<typeof vi.fn>;
  let openDialog: ReturnType<typeof vi.fn>;
  let closed: Subject<boolean | undefined>;
  let snackBar: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    api = {
      getById: vi.fn(() => of(character)),
      previewOpeningBaseline: vi.fn(() => of({ currentClassesString: 'Barbarian1', currentGold: 50, currentDowntime: 4 })),
      update: vi.fn(() => of(character)),
      create: vi.fn(() => of(character)),
    };
    navigate = vi.fn();
    closed = new Subject<boolean | undefined>();
    openDialog = vi.fn(() => ({ afterClosed: () => closed.asObservable() }));
    snackBar = vi.fn();
    TestBed.configureTestingModule({ providers: [
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'c' }) } } },
      { provide: Router, useValue: { navigate } },
      { provide: MatSnackBar, useValue: { open: snackBar } },
      { provide: MatDialog, useValue: { open: openDialog } },
      { provide: CharacterService, useValue: api },
      { provide: AuthService, useValue: {} },
    ] });
    component = TestBed.runInInjectionContext(() => new CharacterFormComponent());
    component.ngOnInit();
    component['classEntries'].set([{ className: 'Barbarian', level: 1 }]);
    component['form'].patchValue({ characterName: 'Hero', race: 'Human', initialGold: 50, initialDowntime: 4 });
  });

  it('previews the recalculated current state and saves only after confirmation', () => {
    component['onSubmit']();

    expect(api.previewOpeningBaseline).toHaveBeenCalledWith('c', expect.objectContaining({
      initialClassesString: 'Barbarian1', initialGold: 50, initialDowntime: 4,
    }));
    expect(openDialog).toHaveBeenCalledWith(ConfirmDialogComponent, expect.objectContaining({
      autoFocus: 'button',
      data: expect.objectContaining({
        title: '確認修改開卡值', confirmText: '確認儲存', cancelText: '繼續編輯',
        message: expect.stringContaining('既有冒險及倉庫物品不會自動修改'),
      }),
    }));
    expect(openDialog.mock.calls[0][1].data.message).toContain('金幣：10 金 → 50 金');
    expect(api.update).not.toHaveBeenCalled();
    closed.next(true);
    expect(api.update).toHaveBeenCalledWith('c', expect.objectContaining({ initialClassesString: 'Barbarian1' }));
    expect(navigate).toHaveBeenCalledWith(['/characters', 'c', 'adventures']);
  });

  it.each([false, undefined])('preserves edits when confirmation closes with %s', (result) => {
    component['onSubmit']();
    closed.next(result);

    expect(api.previewOpeningBaseline).toHaveBeenCalledTimes(1);
    expect(api.update).not.toHaveBeenCalled();
    expect(component['isSaving']()).toBe(false);
    expect(component['form'].get('initialGold')!.value).toBe(50);
    expect(component['classEntries']()).toEqual([{ className: 'Barbarian', level: 1 }]);
    component['onSubmit']();
    expect(openDialog).toHaveBeenCalledTimes(2);
    expect(api.update).not.toHaveBeenCalled();
  });

  function restoreBaseline(): void {
    component['classEntries'].set([{ className: 'Fighter', level: 5 }]);
    component['form'].patchValue({ initialGold: 10, initialDowntime: 2 });
  }

  it.each(['class', 'level', 'gold', 'downtime'])('confirms a %s change without adventures', (field) => {
    component['hasAdventureEntries'].set(false);
    restoreBaseline();
    if (field === 'class') component['classEntries'].set([{ className: 'Barbarian', level: 5 }]);
    if (field === 'level') component['classEntries'].set([{ className: 'Fighter', level: 6 }]);
    if (field === 'gold') component['form'].patchValue({ initialGold: 11 });
    if (field === 'downtime') component['form'].patchValue({ initialDowntime: 3 });
    component['onSubmit']();
    expect(api.previewOpeningBaseline).not.toHaveBeenCalled();
    expect(openDialog).toHaveBeenCalledTimes(1);
    expect(api.update).not.toHaveBeenCalled();
    closed.next(true);
    expect(api.update).toHaveBeenCalledTimes(1);
  });

  it('saves identity edits directly when the baseline is restored, including equal number formatting', () => {
    restoreBaseline();
    component['form'].patchValue({ characterName: 'Renamed', initialGold: '10.00' });
    component['avatarUrl'].set('data:image/webp;base64,preview');
    component['onSubmit']();
    expect(api.previewOpeningBaseline).not.toHaveBeenCalled();
    expect(openDialog).not.toHaveBeenCalled();
    expect(api.update).toHaveBeenCalledWith('c', expect.objectContaining({ characterName: 'Renamed' }));
  });

  it('does not confuse canonical aliases or reordered class entries with a baseline change', () => {
    api.getById.mockReturnValue(of({ ...character, initialClassesString: '戰士3/法師2' }));
    component.ngOnInit();
    component['classEntries'].set([{ className: 'Wizard', level: 2 }, { className: 'Fighter', level: 3 }]);
    component['onSubmit']();
    expect(openDialog).not.toHaveBeenCalled();
    expect(api.update).toHaveBeenCalledTimes(1);
  });

  it('creates a new character without baseline confirmation', () => {
    component['isEditMode'].set(false);
    component['onSubmit']();
    expect(openDialog).not.toHaveBeenCalled();
    expect(api.previewOpeningBaseline).not.toHaveBeenCalled();
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.update).not.toHaveBeenCalled();
  });

  it('does not submit an invalid baseline', () => {
    component['form'].patchValue({ initialGold: -1 });
    component['onSubmit']();
    expect(openDialog).not.toHaveBeenCalled();
    expect(api.previewOpeningBaseline).not.toHaveBeenCalled();
    expect(api.update).not.toHaveBeenCalled();
  });

  it('blocks repeated submissions during preview, confirmation, and saving', () => {
    const preview = new Subject<{ currentGold: number; currentDowntime: number }>();
    const update = new Subject<typeof character>();
    api.previewOpeningBaseline.mockReturnValue(preview);
    api.update.mockReturnValue(update);
    component['onSubmit']();
    component['onSubmit']();
    expect(api.previewOpeningBaseline).toHaveBeenCalledTimes(1);
    preview.next({ currentGold: 50, currentDowntime: 4 });
    component['onSubmit']();
    expect(openDialog).toHaveBeenCalledTimes(1);
    closed.next(true);
    component['onSubmit']();
    expect(api.update).toHaveBeenCalledTimes(1);
  });

  it('keeps edits and allows retry after preview failure', () => {
    api.previewOpeningBaseline.mockReturnValueOnce(throwError(() => new Error('preview failed')));
    component['onSubmit']();
    expect(component['isSaving']()).toBe(false);
    expect(api.update).not.toHaveBeenCalled();
    expect(openDialog).not.toHaveBeenCalled();
    expect(component['formError']()).toBe('無法預覽修正結果，資料尚未儲存，請重試。');
    component['onSubmit']();
    expect(openDialog).toHaveBeenCalledTimes(1);
    closed.next(true);
    expect(api.update).toHaveBeenCalledTimes(1);
  });

  it('requires confirmation again after an update failure', () => {
    api.update.mockReturnValueOnce(throwError(() => new Error('update failed')));
    component['onSubmit']();
    closed.next(true);
    expect(component['isSaving']()).toBe(false);
    expect(component['formError']()).toBe('更新失敗，請稍後再試');
    component['onSubmit']();
    expect(openDialog).toHaveBeenCalledTimes(2);
    expect(api.update).toHaveBeenCalledTimes(1);
  });
});
