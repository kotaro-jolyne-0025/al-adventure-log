import { TestBed } from '@angular/core/testing';
import { ElementRef } from '@angular/core';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, Subject, throwError } from 'rxjs';
import { AdventureFormComponent } from './adventure-form.component';
import { AdventureDraftSession } from '../../../core/services/adventure-draft-session';
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
    adventureName: 'A', startingLevel: 1, endingLevel: 1, magicItemsLost: 0, magicItemsDowntimeLost: 0, downtimeActivities: [], storyAwards: [] };

  beforeEach(() => {
    entry = new Subject(); items = new Subject(); awards = new Subject(); warehouse = new Subject();
    api = { getById: vi.fn(() => entry), getGainedItems: vi.fn(() => items),
      getStoryAwards: vi.fn(() => awards), updateWithDetails: vi.fn(() => of(data)) };
    TestBed.configureTestingModule({ providers: [
      AdventureDraftSession,
      { provide: ElementRef, useValue: { nativeElement: document.createElement('div') } },
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
    items.complete(); component['form'].patchValue({ magicItemsChange: 1 }); submit();
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

  it('ignores manual count and saves consumables without increasing permanent totals', () => {
    emitEntry(); emitAwards();
    items.next([{ id: 'potion', adventureEntryId: 'e', itemType: 'CONSUMABLE',
      itemName: 'Potion', quantity: 2, itemCategory: 'POTION' }]);
    items.complete();
    expect(component['isSectionExpanded']('magic-items', 0)).toBe(false);
    expect(component['isSectionExpanded']('consumables', 1)).toBe(true);
    component['form'].patchValue({ magicItemsChange: 3 });
    submit();
    expect(component['magicItemsNetChange']()).toBe(0);
    expect(api.updateWithDetails).toHaveBeenCalledWith('c', 'e', expect.objectContaining({
      gainedItems: [expect.objectContaining({ quantity: 2, itemCategory: 'POTION' })],
    }));
  });

  it('waits for legacy warehouse fallback and preserves its ID on save', () => {
    emitEntry(); emitAwards(); items.next([]); items.complete(); submit();
    expect(api.updateWithDetails).not.toHaveBeenCalled();
    warehouse.next([{ id: 'legacy', characterId: 'c', adventureEntryId: 'e', itemName: 'Sword',
      itemType: 'PERMANENT', quantity: 1 }]);
    warehouse.complete(); component['form'].patchValue({ magicItemsChange: 1 }); submit();
    expect(api.updateWithDetails).toHaveBeenCalledWith('c', 'e', expect.objectContaining({
      gainedItems: [expect.objectContaining({ id: 'legacy' })],
    }));
  });

  it('reopens a collapsed item section when adding and when a hidden name fails validation', () => {
    emitEntry(); emitAwards();
    items.next([{ id: 'snapshot', adventureEntryId: 'e', itemType: 'PERMANENT', itemName: 'Sword' }]);
    items.complete();
    component['form'].patchValue({ magicItemsChange: 1 });
    component['toggleSection']('magic-items');
    expect(component['isSectionExpanded']('magic-items', 1)).toBe(false);
    component['addGainedItem']();
    expect(component['isSectionExpanded']('magic-items', 2)).toBe(true);
    expect(component['gainedMagicItems']()[0].id).toBe('snapshot');
    component['toggleSection']('magic-items');
    submit();
    expect(api.updateWithDetails).not.toHaveBeenCalled();
    expect(component['isSectionExpanded']('magic-items', 2)).toBe(true);
  });

  it('does not permit save when the legacy fallback fails', () => {
    emitEntry(); emitAwards(); items.next([]); items.complete();
    warehouse.error(new Error('offline')); submit();
    expect(component['loadFailed']()).toBe(true);
    expect(api.updateWithDetails).not.toHaveBeenCalled();
  });

  it('loads and saves the soul coin flag without filling or clearing other loot fields', () => {
    emitEntry(); emitAwards();
    items.next([{ id: 'coin', adventureEntryId: 'e', itemType: 'CONSUMABLE',
      itemName: 'Custom', quantity: 2, rarity: null, itemCategory: null, isSoulCoin: true, notes: 'Player notes' }]);
    items.complete();
    const original = component['gainedConsumableItems']()[0];
    expect(original.isSoulCoin).toBe(true);
    component['updateGainedConsumableItemSoulCoin'](0, false);
    expect(component['gainedConsumableItems']()[0]).toEqual({ ...original, isSoulCoin: false });
    component['updateGainedConsumableItemSoulCoin'](0, true);
    expect(component['gainedConsumableItems']()[0]).toEqual(original);
    submit();
    expect(api.updateWithDetails.mock.calls[0][2].gainedItems).toEqual([
      expect.objectContaining({ id: 'coin', itemName: 'Custom', quantity: 2, isSoulCoin: true,
        rarity: null, itemCategory: null, notes: 'Player notes' }),
    ]);
  });

  it('derives acquisition sources and losses while consumables do not affect the count', () => {
    emitEntry(); emitAwards();
    items.next([{ id: 'sword', adventureEntryId: 'e', itemType: 'PERMANENT', itemName: 'Sword' }]);
    items.complete();
    component['form'].patchValue({ startingMagicItems: 2, magicItemsLost: 1 });
    expect(component['magicItemsNetChange']()).toBe(0);
    component['updateGainedItemSource'](0, 'DOWNTIME');
    expect(component['adventureMagicGained']()).toBe(0);
    expect(component['downtimeMagicGained']()).toBe(1);
    component['gainedConsumableItems'].set([{ itemName: 'Coins', quantity: 3, rarity: '', isSoulCoin: true, itemCategory: 'WONDROUS_ITEM', notes: '' }]);
    expect(component['magicItemsNetChange']()).toBe(0);
    submit();
    expect(api.updateWithDetails.mock.calls[0][2].entry).toMatchObject({
      magicItemsChange: -1, magicItemsDowntimeChange: 1, magicItemsLost: 1, magicItemsDowntimeLost: 0,
    });
  });

  it('keeps saving blocked when story awards fail to load', () => {
    emitEntry();
    items.next([{ id: 'snapshot', adventureEntryId: 'e', itemType: 'PERMANENT', itemName: 'Sword' }]);
    items.complete();
    awards.error(new Error('offline')); submit();
    expect(component['loadFailed']()).toBe(true);
    expect(api.updateWithDetails).not.toHaveBeenCalled();
  });

  it('keeps details and supports retry after an API business error', () => {
    emitEntry(); emitAwards();
    items.next([{ id:'sword',adventureEntryId:'e',itemType:'PERMANENT',itemName:'Sword' }]); items.complete();
    api.updateWithDetails.mockReturnValue(throwError(() => ({ error:{message:'資源不足，請修正'} })));
    submit();
    expect(component['formError']()).toBe('資源不足，請修正');
    expect(component['isSaving']()).toBe(false);
    expect(component['gainedMagicItems']()[0].itemName).toBe('Sword');
    api.updateWithDetails.mockReturnValue(of(data)); submit();
    expect(component['formError']()).toBeNull();
    expect(api.updateWithDetails).toHaveBeenCalledTimes(2);
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

    component['gainedConsumableItems'].set([{ itemName: 'Potion', quantity: 2, rarity: '', itemCategory: 'POTION', notes: '' }]);
    expect(component['goldNetChange']()).toBe(30);
    expect(component['downtimeNetChange']()).toBe(1);
    expect(component['magicItemsNetChange']()).toBe(1);
    expect(component['goldTotal']()).toBe(130);
    expect(component['downtimeTotal']()).toBe(6);
    expect(component['magicItemsTotal']()).toBe(4);
    expect(component['isResourceValid']()).toBe(true);

    submit();
    const payload = api.updateWithDetails.mock.calls[0][2];
    expect(payload.entry).toMatchObject({
      goldChange: 50, goldDowntimeChange: -20,
      downtimeChange: 2, downtimeDowntimeChange: -1,
      magicItemsChange: 1, magicItemsDowntimeChange: 0,
    });
    expect(payload.entry).not.toHaveProperty('startingGold');
  });
});
