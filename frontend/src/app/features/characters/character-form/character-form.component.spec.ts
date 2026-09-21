import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { CharacterService } from '../../../core/services/character.service';
import { AuthService } from '../../../core/services/auth.service';
import { CharacterFormComponent } from './character-form.component';

describe('CharacterFormComponent opening baseline edit', () => {
  const character = {
    id: 'c', characterName: 'Hero', race: 'Human', initialClassesString: 'Fighter5',
    currentClassesString: 'Fighter5', initialGold: 10, currentGold: 10,
    initialDowntime: 2, currentDowntime: 2, hasAdventureEntries: true,
  };
  let component: CharacterFormComponent;
  let api: { getById: ReturnType<typeof vi.fn>; previewOpeningBaseline: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn> };
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    api = {
      getById: vi.fn(() => of(character)),
      previewOpeningBaseline: vi.fn(() => of({ currentClassesString: 'Barbarian1', currentGold: 50, currentDowntime: 4 })),
      update: vi.fn(() => of(character)),
    };
    navigate = vi.fn();
    TestBed.configureTestingModule({ providers: [
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'c' }) } } },
      { provide: Router, useValue: { navigate } },
      { provide: MatSnackBar, useValue: { open: vi.fn() } },
      { provide: MatDialog, useValue: { open: vi.fn() } },
      { provide: CharacterService, useValue: api },
      { provide: AuthService, useValue: {} },
    ] });
    component = TestBed.runInInjectionContext(() => new CharacterFormComponent());
    component.ngOnInit();
    component['classEntries'].set([{ className: 'Barbarian', level: 1 }]);
    component['form'].patchValue({ characterName: 'Hero', race: 'Human', initialGold: 50, initialDowntime: 4 });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('previews the recalculated current state and saves only after confirmation', () => {
    const confirm = vi.fn(() => true);
    vi.stubGlobal('confirm', confirm);

    component['onSubmit']();

    expect(api.previewOpeningBaseline).toHaveBeenCalledWith('c', expect.objectContaining({
      initialClassesString: 'Barbarian1', initialGold: 50, initialDowntime: 4,
    }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('既有冒險快照不會改動'));
    expect(api.update).toHaveBeenCalledWith('c', expect.objectContaining({ initialClassesString: 'Barbarian1' }));
  });

  it('does not save if the player cancels the preview confirmation', () => {
    vi.stubGlobal('confirm', vi.fn(() => false));

    component['onSubmit']();

    expect(api.previewOpeningBaseline).toHaveBeenCalledTimes(1);
    expect(api.update).not.toHaveBeenCalled();
    expect(component['isSaving']()).toBe(false);
  });
});
