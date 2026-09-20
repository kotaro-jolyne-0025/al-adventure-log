import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, Subject } from 'rxjs';
import { AdventureFormComponent } from './adventure-form.component';
import { AdventureService } from '../../../core/services/adventure.service';
import { InventoryService } from '../../../core/services/inventory.service';
import { AdventureEntry, AdventureGainedItem, StoryAward } from '../../../core/models/adventure.model';
import { InventoryItem } from '../../../core/models/inventory.model';

describe('Adventure form complete loading', () => {
  let component: AdventureFormComponent;
  let entry: Subject<AdventureEntry>;
  let items: Subject<AdventureGainedItem[]>;
  let awards: Subject<StoryAward[]>;
  let warehouse: Subject<InventoryItem[]>;
  let api: { getById: ReturnType<typeof vi.fn>; getGainedItems: ReturnType<typeof vi.fn>;
    getStoryAwards: ReturnType<typeof vi.fn>; updateWithDetails: ReturnType<typeof vi.fn> };
  const data: AdventureEntry = { id: 'e', characterId: 'c', playDate: '2026-09-17',
    adventureName: 'A', startingLevel: 1, endingLevel: 1, downtimeActivities: [], storyAwards: [] };

  beforeEach(() => {
    entry = new Subject(); items = new Subject(); awards = new Subject(); warehouse = new Subject();
    api = { getById: vi.fn(() => entry), getGainedItems: vi.fn(() => items),
      getStoryAwards: vi.fn(() => awards), updateWithDetails: vi.fn(() => of(data)) };
    TestBed.configureTestingModule({ providers: [
      { provide: ActivatedRoute, useValue: { parent: { snapshot: { paramMap: convertToParamMap({ id: 'c' }) } },
        snapshot: { paramMap: convertToParamMap({ entryId: 'e' }) } } },
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: MatSnackBar, useValue: { open: vi.fn() } },
      { provide: AdventureService, useValue: api },
      { provide: InventoryService, useValue: { getAllByCharacter: () => warehouse } },
    ] });
    component = TestBed.runInInjectionContext(() => new AdventureFormComponent());
    component.ngOnInit();
  });

  function submit(): void { component['onSubmit'](); }
  function emitEntry(): void { entry.next(data); entry.complete(); }
  function emitAwards(): void { awards.next([]); awards.complete(); }

  it('blocks submit while item loading is pending and allows it after successful completion', () => {
    emitEntry(); emitAwards(); submit();
    expect(api.updateWithDetails).not.toHaveBeenCalled();
    items.next([{ id: 'snapshot', adventureEntryId: 'e', itemType: 'PERMANENT', itemName: 'Sword' }]);
    items.complete(); submit();
    expect(api.updateWithDetails).toHaveBeenCalledWith('c', 'e', expect.objectContaining({
      gainedItems: [expect.objectContaining({ id: 'snapshot' })],
    }));
    const payload = api.updateWithDetails.mock.calls[0][2];
    expect(payload.entry).toMatchObject({ levelChange: 0, classChanges: [] });
    expect(payload.entry).not.toHaveProperty('startingLevel');
    expect(payload.entry).not.toHaveProperty('endingLevel');
    expect(payload.entry).not.toHaveProperty('startingGold');
    expect(payload.entry).not.toHaveProperty('startingDowntime');
    expect(payload.entry).not.toHaveProperty('startingMagicItems');
    expect(payload.entry).not.toHaveProperty('endingClassesString');
    submit();
    expect(api.updateWithDetails).toHaveBeenCalledTimes(1);
  });

  it('keeps saving blocked on read error and can recover through retry', () => {
    emitEntry(); emitAwards(); items.error(new Error('offline')); submit();
    expect(component['loadFailed']()).toBe(true);
    expect(api.updateWithDetails).not.toHaveBeenCalled();
    api.getById.mockReturnValue(of(data));
    api.getGainedItems.mockReturnValue(of([]));
    api.getStoryAwards.mockReturnValue(of([]));
    component['retryLoad']();
    warehouse.next([]); warehouse.complete(); submit();
    expect(api.updateWithDetails).toHaveBeenCalledTimes(1);
  });

  it('waits for legacy warehouse fallback and preserves its ID on save', () => {
    emitEntry(); emitAwards(); items.next([]); items.complete(); submit();
    expect(api.updateWithDetails).not.toHaveBeenCalled();
    warehouse.next([{ id: 'legacy', characterId: 'c', adventureEntryId: 'e', itemName: 'Sword',
      itemType: 'PERMANENT', quantity: 1 }]);
    warehouse.complete(); submit();
    expect(api.updateWithDetails).toHaveBeenCalledWith('c', 'e', expect.objectContaining({
      gainedItems: [expect.objectContaining({ id: 'legacy' })],
    }));
  });

  it('does not permit save when the legacy fallback fails', () => {
    emitEntry(); emitAwards(); items.next([]); items.complete();
    warehouse.error(new Error('offline')); submit();
    expect(component['loadFailed']()).toBe(true);
    expect(api.updateWithDetails).not.toHaveBeenCalled();
  });

  it('keeps saving blocked when story awards fail to load', () => {
    emitEntry();
    items.next([{ id: 'snapshot', adventureEntryId: 'e', itemType: 'PERMANENT', itemName: 'Sword' }]);
    items.complete();
    awards.error(new Error('offline')); submit();
    expect(component['loadFailed']()).toBe(true);
    expect(api.updateWithDetails).not.toHaveBeenCalled();
  });

  it('does not adopt another adventure item through a matching source label', () => {
    emitEntry(); emitAwards(); items.next([]); items.complete();
    warehouse.next([{ id: 'other', characterId: 'c', adventureEntryId: 'another-entry', source: 'A',
      itemName: 'Sword', itemType: 'PERMANENT', quantity: 1 }]);
    warehouse.complete(); submit();
    expect(api.updateWithDetails).toHaveBeenCalledWith('c', 'e', expect.objectContaining({ gainedItems: [] }));
  });

  it('previews totals from initial snapshots and changes without sending the initial snapshots', () => {
    emitEntry(); emitAwards();
    items.next([{ id: 'snapshot', adventureEntryId: 'e', itemType: 'PERMANENT', itemName: 'Sword' }]);
    items.complete();
    component['form'].patchValue({
      startingGold: 100, goldChange: 50, goldDowntimeChange: -20,
      startingDowntime: 5, downtimeChange: 2, downtimeDowntimeChange: -1,
      startingMagicItems: 3, magicItemsChange: 1, magicItemsDowntimeChange: 2,
    });

    expect(component['goldTotal']()).toBe(130);
    expect(component['downtimeTotal']()).toBe(6);
    expect(component['magicItemsTotal']()).toBe(6);
    expect(component['isResourceValid']()).toBe(true);

    submit();
    const payload = api.updateWithDetails.mock.calls[0][2];
    expect(payload.entry).toMatchObject({
      goldChange: 50, goldDowntimeChange: -20,
      downtimeChange: 2, downtimeDowntimeChange: -1,
      magicItemsChange: 1, magicItemsDowntimeChange: 2,
    });
    expect(payload.entry).not.toHaveProperty('startingGold');
  });
});
