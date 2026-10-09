import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { CharacterService } from '../../../core/services/character.service';
import { CharacterListComponent } from './character-list.component';

describe('Character list read state', () => {
  it('distinguishes read failure from successful empty results and can retry', () => {
    const getAll = vi.fn().mockReturnValueOnce(throwError(() => ({ status: 500 }))).mockReturnValue(of([]));
    TestBed.configureTestingModule({ providers: [
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: MatSnackBar, useValue: { open: vi.fn() } },
      { provide: MatDialog, useValue: { open: vi.fn() } },
      { provide: CharacterService, useValue: { getAll } },
    ] });
    const component = TestBed.runInInjectionContext(() => new CharacterListComponent());
    component.ngOnInit();
    expect(component['hasLoaded']()).toBe(false);
    expect(component['loadError']()).toContain('重試');
    component['loadCharacters']();
    expect(component['hasLoaded']()).toBe(true);
    expect(component['loadError']()).toBeNull();
    expect(component['characters']()).toEqual([]);
  });
});
