import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, Subject } from 'rxjs';
import { CharacterListComponent } from '../../features/characters/character-list/character-list.component';
import { CharacterShellComponent } from '../../features/characters/character-shell/character-shell.component';
import { AdventureListComponent } from '../../features/adventures/adventure-list/adventure-list.component';
import { AdventureDetailComponent } from '../../features/adventures/adventure-detail/adventure-detail.component';
import { InventoryListComponent } from '../../features/inventory/inventory-list/inventory-list.component';
import { LocalReadCache, ReadResult } from './local-read-cache.service';
import { LocalStore } from './local-store.service';
import { CharacterService } from './character.service';
import { AdventureService } from './adventure.service';
import { InventoryService } from './inventory.service';

const hero = { id: 'c', characterName: 'Hero', currentGold: 12 };
const entry = { id: 'e', adventureName: 'Adventure' };
const item = { id: 'i', itemName: 'Item', itemType: 'PERMANENT' };
const pages = [
  { name: 'characters', create: () => new CharacterListComponent(), refresh: 'loadCharacters', value: 'characters', data: [hero], updated: [{ ...hero, currentGold: 20 }] },
  { name: 'HUD', create: () => new CharacterShellComponent(), refresh: 'loadCharacterData', value: 'character', data: hero, updated: { ...hero, currentGold: 20 } },
  { name: 'adventures', create: () => new AdventureListComponent(), refresh: 'loadEntries', value: 'rawEntries', data: [entry], updated: [{ ...entry, adventureName: 'Updated' }] },
  { name: 'detail', create: () => new AdventureDetailComponent(), refresh: 'loadEntry', value: 'entry', data: { entry, gainedItems: [], storyAwards: [], legacyItems: [] }, updated: { entry: { ...entry, adventureName: 'Updated' }, gainedItems: [], storyAwards: [], legacyItems: [] } },
  { name: 'inventory', create: () => new InventoryListComponent(), refresh: 'loadItems', value: 'allItems', data: [item], updated: [{ ...item, itemName: 'Updated' }] },
];

describe.each(pages)('Background refresh: $name', page => {
  function setup() {
    const refresh = new Subject<ReadResult<unknown>>();
    const read = vi.fn().mockReturnValueOnce(of({ data: page.data, source: 'cloud', fetchedAt: 200 }))
      .mockReturnValue(refresh);
    const snapshot = { paramMap: convertToParamMap({ id: 'c', entryId: 'e' }) };
    TestBed.configureTestingModule({ providers: [
      { provide: ActivatedRoute, useValue: { snapshot, paramMap: of(snapshot.paramMap), parent: { snapshot, paramMap: of(snapshot.paramMap) } } },
      { provide: Router, useValue: { url: '/characters/c/adventures', navigate: vi.fn() } },
      { provide: MatDialog, useValue: {} }, { provide: MatSnackBar, useValue: {} },
      { provide: LocalReadCache, useValue: { read } },
      { provide: CharacterService, useValue: { characterChanged$: new Subject() } },
      { provide: AdventureService, useValue: {} }, { provide: InventoryService, useValue: {} },
    ] });
    const component = TestBed.runInInjectionContext(() => page.create());
    const value = (key: string) => (Reflect.get(component, key) as () => unknown)();
    component.ngOnInit();
    TestBed.inject(LocalStore).markFresh('c', true);
    return { refresh, value, load: () => Reflect.get(component, page.refresh).call(component) };
  }

  it('keeps displayed content while blocking writes, then accepts the latest cloud data', () => {
    const { refresh, value, load } = setup();
    const original = value(page.value);
    load();
    expect(value(page.value)).toEqual(original);
    expect(value('isLoading')).toBe(false);
    expect(value('isRefreshing')).toBe(true);
    expect(value('readOnly')).toBe(true);
    refresh.next({ data: null, source: 'copy', fetchedAt: 100 });
    expect(value(page.value)).toEqual(original);
    expect(value('fetchedAt')).toBe(200);
    refresh.next({ data: page.updated, source: 'cloud', fetchedAt: 300 });
    refresh.complete();
    expect(value(page.value)).not.toEqual(original);
    expect(value('readOnly')).toBe(false);
    expect(value('isRefreshing')).toBe(false);
  });

  it.each([403, 404])('clears content after access failure (%s)', status => {
    const { refresh, value, load } = setup();
    load();
    refresh.error({ status });
    expect(value(page.value)).toEqual(['character', 'entry'].includes(page.value) ? null : []);
    expect(value('readOnly')).toBe(true);
    expect(value('isRefreshing')).toBe(false);
    expect(value('loadError')).toBeTruthy();
  });
});
