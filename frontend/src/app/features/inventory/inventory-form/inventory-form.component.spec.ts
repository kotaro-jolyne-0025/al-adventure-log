import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject, of, throwError } from 'rxjs';
import { InventoryService } from '../../../core/services/inventory.service';
import { AdventureService } from '../../../core/services/adventure.service';
import { InventoryItem } from '../../../core/models/inventory.model';
import { InventoryFormComponent } from './inventory-form.component';

describe('Inventory edit initialization', () => {
  it.each([false, true])('saves the selected adventure name without relation IDs (edit: %s)', async (edit) => {
    const create = vi.fn((_character: string, _request: unknown) => of({} as InventoryItem));
    const update = vi.fn((_character: string, _id: string, _request: unknown) => of({} as InventoryItem));
    const item: InventoryItem = { id: 'i', characterId: 'c', itemName: 'Potion', itemType: 'CONSUMABLE',
      quantity: 1, source: '原來源', adventureEntryId: 'original', updatedAt: '2026-11-10T00:00:00' };
    const name = '長'.repeat(255);
    const getAllByCharacter = vi.fn()
      .mockReturnValueOnce(throwError(() => ({ status: 500 })))
      .mockReturnValueOnce(of([
        { id: 'a1', adventureName: name, adventureCode: 'TEST', playDate: '2026-11-09' },
        { id: 'a2', adventureName: name, adventureCode: 'TEST', playDate: '2026-11-10' },
        { id: 'a3', adventureCode: 'NO-NAME', playDate: '2026-11-11' },
        { id: 'a4', adventureName: '另一場冒險', playDate: '2026-11-08' },
      ]));
    TestBed.configureTestingModule({ providers: [
      { provide: ActivatedRoute, useValue: {
        parent: { snapshot: { paramMap: convertToParamMap({ id: 'c' }) } },
        snapshot: { paramMap: convertToParamMap(edit ? { itemId: 'i' } : {}), queryParamMap: convertToParamMap({}) },
      } },
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: MatSnackBar, useValue: { open: vi.fn() } },
      { provide: InventoryService, useValue: { create, update, getAllByCharacter: () => of([item]) } },
      { provide: AdventureService, useValue: { getAllByCharacter } },
    ] });
    const fixture = TestBed.createComponent(InventoryFormComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    if (edit) expect(component['form'].value.source).toBe(item.source);
    component['form'].patchValue({ itemName: 'Potion', source: '手填來源' });
    const sourcePicker: HTMLButtonElement = fixture.nativeElement.querySelector('button[aria-label="選擇冒險"]');
    sourcePicker.click();
    await fixture.whenStable();
    expect(getAllByCharacter).toHaveBeenCalledWith('c', true);
    expect(component['form'].value.source).toBe('手填來源');
    expect(fixture.nativeElement.querySelector('app-read-error')).not.toBeNull();
    component['loadSourceAdventures']();
    fixture.detectChanges();
    const options = Array.from(document.querySelectorAll<HTMLElement>('[role="option"]'));
    expect(options.map(option => option.textContent?.trim())).toEqual([name, '另一場冒險']);
    options[0].click();
    expect(component['form'].value.source).toBe(name);
    component['onSubmit']();
    if (edit) {
      expect(update).toHaveBeenCalledWith('c', 'i', expect.objectContaining({ source: name, expectedUpdatedAt: item.updatedAt }));
    } else {
      expect(create).toHaveBeenCalledWith('c', expect.objectContaining({ source: name }));
    }
    const request = edit ? update.mock.calls[0][2] : create.mock.calls[0][1];
    expect(request).not.toHaveProperty('adventureEntryId');
    expect(request).not.toHaveProperty('adventureGainedItemId');
  });

  it('creates a permanent inventory item as one independent item', () => {
    const create = vi.fn(() => of({} as InventoryItem));
    TestBed.configureTestingModule({ providers: [
      { provide: ActivatedRoute, useValue: {
        parent: { snapshot: { paramMap: convertToParamMap({ id: 'c' }) } },
        snapshot: { paramMap: convertToParamMap({}), queryParamMap: convertToParamMap({}) },
      } },
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: MatSnackBar, useValue: { open: vi.fn() } },
      { provide: InventoryService, useValue: { create } },
    ] });
    const fixture = TestBed.createComponent(InventoryFormComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(fixture.nativeElement.querySelector('mat-select[formControlName="itemType"]')).not.toBeNull();
    component['form'].patchValue({ itemName: 'Ring', quantity: 0 });
    component['onSubmit']();

    expect(create).toHaveBeenCalledWith('c', expect.objectContaining({ itemType: 'PERMANENT', quantity: 1 }));
  });

  it.each([409, 428])('preserves the item input and original timestamp after status %i', status => {
    const item: InventoryItem = { id: 'i', characterId: 'c', itemName: 'Sword', itemType: 'PERMANENT',
      quantity: 1, updatedAt: '2026-10-14T01:02:03.123456' };
    const update = vi.fn((_character: string, _item: string, _request: unknown) =>
      throwError(() => ({ status, error: { message: 'Review the new version' } })));
    const navigate = vi.fn();
    TestBed.configureTestingModule({ providers: [
      { provide: ActivatedRoute, useValue: {
        parent: { snapshot: { paramMap: convertToParamMap({ id: 'c' }) } },
        snapshot: { paramMap: convertToParamMap({ itemId: 'i' }), queryParamMap: convertToParamMap({}) },
      } },
      { provide: Router, useValue: { navigate } },
      { provide: MatSnackBar, useValue: { open: vi.fn() } },
      { provide: InventoryService, useValue: { getAllByCharacter: () => of([item]), update } },
    ] });
    const component = TestBed.runInInjectionContext(() => new InventoryFormComponent());
    component.ngOnInit();
    component['form'].patchValue({ itemName: 'My edit', quantity: 2 });
    component['onSubmit']();
    expect(component['writeConflict']()).toBe(true);
    expect(component['isSaving']()).toBe(false);
    expect(component['form'].getRawValue()).toMatchObject({ itemName: 'My edit', quantity: 2 });
    expect(navigate).not.toHaveBeenCalled();
    component['onSubmit']();
    expect(update.mock.calls[0][2]).toMatchObject({ expectedUpdatedAt: item.updatedAt });
    expect(update.mock.calls[1][2]).toMatchObject({ expectedUpdatedAt: item.updatedAt });
  });
  it('preserves manual fields when toggling the soul coin marker on an existing consumable', () => {
    const item: InventoryItem = { id: 'i', characterId: 'c', itemName: 'Custom', itemType: 'CONSUMABLE',
      quantity: 2, isSoulCoin: true, notes: 'Player notes' };
    const update = vi.fn(() => new Subject<InventoryItem>());
    TestBed.configureTestingModule({ providers: [
      { provide: ActivatedRoute, useValue: {
        parent: { snapshot: { paramMap: convertToParamMap({ id: 'c' }) } },
        snapshot: { paramMap: convertToParamMap({ itemId: 'i' }), queryParamMap: convertToParamMap({}) },
      } },
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: MatSnackBar, useValue: { open: vi.fn() } },
      { provide: InventoryService, useValue: { getAllByCharacter: () => of([item]), update } },
    ] });
    const component = TestBed.runInInjectionContext(() => new InventoryFormComponent());
    component.ngOnInit();
    const original = component['form'].getRawValue();
    expect(original.isSoulCoin).toBe(true);
    component['form'].patchValue({ isSoulCoin: false });
    expect(component['form'].getRawValue()).toEqual({ ...original, isSoulCoin: false });
    component['form'].patchValue({ isSoulCoin: true });
    component['onSubmit']();
    expect(update).toHaveBeenCalledWith('c', 'i', expect.objectContaining({
      itemName: 'Custom', isSoulCoin: true, rarity: null, itemCategory: null, quantity: 2, notes: 'Player notes',
    }));
  });
  it('blocks saving before load, keeps failures recoverable and prevents duplicate saves', () => {
    let read = new Subject<InventoryItem[]>();
    const saved = new Subject<InventoryItem>();
    const update = vi.fn((_characterId: string, _itemId: string, _request: unknown) => saved);
    const getAllByCharacter = vi.fn(() => read);
    TestBed.configureTestingModule({ providers: [
      { provide: ActivatedRoute, useValue: {
        parent: { snapshot: { paramMap: convertToParamMap({ id: 'c' }) } },
        snapshot: { paramMap: convertToParamMap({ itemId: 'i' }), queryParamMap: convertToParamMap({}) },
      } },
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: MatSnackBar, useValue: { open: vi.fn() } },
      { provide: InventoryService, useValue: { getAllByCharacter, update } },
    ] });
    const component = TestBed.runInInjectionContext(() => new InventoryFormComponent());
    component.ngOnInit();
    component['form'].patchValue({ itemName: 'unloaded input' });
    component['onSubmit']();
    expect(update).not.toHaveBeenCalled();
    read.error({ status: 500 });
    expect(component['loadError']()).toContain('重試');
    component['onSubmit']();
    expect(update).not.toHaveBeenCalled();
    read = new Subject<InventoryItem[]>();
    component['retryLoad']();
    read.next([{ id: 'i', characterId: 'c', itemName: 'loaded item', itemType: 'PERMANENT', quantity: 1 } as InventoryItem]);
    component['onSubmit']();
    component['onSubmit']();
    expect(update).toHaveBeenCalledTimes(1);
    expect(update.mock.calls[0][2]).toMatchObject({ itemName: 'loaded item' });
  });

  it('preserves the quantity of a legacy stacked permanent item when other fields are edited', () => {
    const item: InventoryItem = { id: 'i', characterId: 'c', itemName: 'Legacy staff', itemType: 'PERMANENT', quantity: 3 };
    const update = vi.fn(() => of(item));
    TestBed.configureTestingModule({ providers: [
      { provide: ActivatedRoute, useValue: {
        parent: { snapshot: { paramMap: convertToParamMap({ id: 'c' }) } },
        snapshot: { paramMap: convertToParamMap({ itemId: 'i' }), queryParamMap: convertToParamMap({}) },
      } },
      { provide: Router, useValue: { navigate: vi.fn() } },
      { provide: MatSnackBar, useValue: { open: vi.fn() } },
      { provide: InventoryService, useValue: { getAllByCharacter: () => of([item]), update } },
    ] });
    const fixture = TestBed.createComponent(InventoryFormComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    expect(fixture.nativeElement.querySelector('mat-select[formControlName="itemType"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('input[readonly]')).not.toBeNull();
    component['form'].patchValue({ itemName: 'Renamed staff' });
    component['onSubmit']();

    expect(update).toHaveBeenCalledWith('c', 'i', expect.objectContaining({ itemName: 'Renamed staff', quantity: 3 }));
  });
});
