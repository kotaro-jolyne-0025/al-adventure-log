import { TestBed } from '@angular/core/testing';
import { ElementRef } from '@angular/core';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { InventoryService } from '../../../core/services/inventory.service';
import { InventoryItem } from '../../../core/models/inventory.model';
import { InventoryListComponent } from './inventory-list.component';
import { LocalStore } from '../../../core/services/local-store.service';

describe('Inventory delete recovery', () => {
  it('restores the item when deletion and refresh both fail, retaining search and filters', () => {
    const item = {id:'i',characterId:'c',itemName:'test item',itemType:'PERMANENT',rarity:'RARE',quantity:1} as InventoryItem;
    const getAllByCharacter = vi.fn().mockReturnValueOnce(of([item]))
      .mockReturnValueOnce(throwError(() => ({status:500}))).mockReturnValue(of([item]));
    TestBed.configureTestingModule({providers:[
      {provide:ElementRef,useValue:new ElementRef(document.createElement('div'))},
      {provide:ActivatedRoute,useValue:{parent:{snapshot:{paramMap:convertToParamMap({id:'c'})}}}},
      {provide:Router,useValue:{navigate:vi.fn()}},
      {provide:MatSnackBar,useValue:{open:vi.fn()}},
      {provide:MatDialog,useValue:{open:()=>({afterClosed:()=>of(true)})}},
      {provide:InventoryService,useValue:{getAllByCharacter,delete:()=>throwError(()=>({status:500}))}},
    ]});
    const component=TestBed.runInInjectionContext(()=>new InventoryListComponent());
    component.ngOnInit();
    TestBed.inject(LocalStore).markFresh('c', true);
    component['searchQuery'].set('test');
    component['selectedRarities'].set(new Set(['RARE']));
    component['onDeleteItem'](new Event('click'),item);
    expect(component['allItems']()).toEqual([item]);
    expect(component['loadError']()).toContain('重試');
    expect(component['hasLoaded']()).toBe(true);
    expect(component['permanentItems']()).toEqual([item]);
    component['loadItems']();
    expect(component['loadError']()).toBeNull();
    expect(component['searchQuery']()).toBe('test');
    expect(component['selectedRarities']()).toEqual(new Set(['RARE']));
  });
});

describe('Inventory navigation', () => {
  it('keeps two item categories, unfiltered counts, and list state when opening history', () => {
    const navigate = vi.fn();
    const queryParamMap = new BehaviorSubject(convertToParamMap({}));
    const route = {
      parent: { snapshot: { paramMap: convertToParamMap({ id: 'c' }) } },
      snapshot: {
        paramMap: convertToParamMap({ id: 'c' }),
        queryParamMap: convertToParamMap({}),
      },
      queryParamMap,
    };
    TestBed.configureTestingModule({ providers: [
      { provide: ElementRef, useValue: new ElementRef(document.createElement('div')) },
      { provide: ActivatedRoute, useValue: route },
      { provide: Router, useValue: { navigate } },
      { provide: MatSnackBar, useValue: { open: vi.fn() } },
      { provide: MatDialog, useValue: { open: vi.fn() } },
      { provide: InventoryService, useValue: { getAllByCharacter: () => of([]) } },
    ] });
    const component = TestBed.runInInjectionContext(() => new InventoryListComponent());
    component.ngOnInit();
    TestBed.inject(LocalStore).markFresh('c', true);
    component['allItems'].set([
      { id: 'p1', itemName: 'Permanent', itemType: 'PERMANENT', quantity: 1 },
      { id: 'c1', itemName: 'Potion', itemType: 'CONSUMABLE', quantity: 3 },
      { id: 'c2', itemName: 'Antidote', itemType: 'CONSUMABLE', quantity: 1 },
    ] as InventoryItem[]);
    component['activeTab'].set(1);
    component['searchQuery'].set('Potion');

    expect(component['rawPermanentCount']()).toBe(1);
    expect(component['rawConsumableCount']()).toBe(2);
    expect(component['consumableItems']()).toHaveLength(1);
    component['onAddItem']();
    expect(navigate).toHaveBeenLastCalledWith(['/characters', 'c', 'inventory', 'new'], {
      queryParams: { type: 'CONSUMABLE' },
    });
    component['selectedRarities'].set(new Set(['RARE']));
    component['sortOrder'].set('asc');
    queryParamMap.next(convertToParamMap({ view: 'history' }));
    expect(component['historyView']()).toBe(true);
    queryParamMap.next(convertToParamMap({}));
    expect(component['historyView']()).toBe(false);
    expect(component['activeTab']()).toBe(1);
    expect(component['searchQuery']()).toBe('Potion');
    expect(component['selectedRarities']()).toEqual(new Set(['RARE']));
    expect(component['sortOrder']()).toBe('asc');
    component['resetContext']('other-character');
    expect(component['activeTab']()).toBe(0);
    expect(component['searchQuery']()).toBe('');
  });
});
