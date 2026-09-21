import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, of } from 'rxjs';
import { CharacterService } from '../../../core/services/character.service';
import { CharacterShellComponent } from './character-shell.component';

describe('CharacterShellComponent', () => {
  it('reads current HUD values only from character and refreshes after mutations', () => {
    const changed = new Subject<string | void>();
    const character = {
      id: 'c', characterName: 'Hero', race: 'Human',
      currentClassesString: '戰士 (Fighter)2/法師 (Wizard)1',
      currentGold: 12.5, currentDowntime: 3, currentMagicItems: 4,
    };
    const getById = vi.fn(() => of(character));
    TestBed.configureTestingModule({ providers: [
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: 'c' }) } } },
      { provide: Router, useValue: { url: '/characters/c/adventures', navigate: vi.fn() } },
      { provide: MatSnackBar, useValue: { open: vi.fn() } },
      { provide: CharacterService, useValue: { getById, characterChanged$: changed } },
    ] });

    const component = TestBed.runInInjectionContext(() => new CharacterShellComponent());
    component.ngOnInit();

    expect(component['character']()).toEqual(character);
    expect(component['parseTotalLevel']()).toBe(3);
    changed.next('c');
    expect(getById).toHaveBeenCalledTimes(2);
    component.ngOnDestroy();
  });
});
