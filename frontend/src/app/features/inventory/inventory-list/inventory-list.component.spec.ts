import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, throwError } from 'rxjs';
import { InventoryService } from '../../../core/services/inventory.service';
import { InventoryItem } from '../../../core/models/inventory.model';
import { InventoryListComponent } from './inventory-list.component';

describe('Inventory delete recovery', () => {
  it('restores the item when deletion and refresh both fail, retaining search and filters', () => {
    const item = {id:'i',characterId:'c',itemName:'test item',itemType:'PERMANENT',rarity:'RARE',quantity:1} as InventoryItem;
    const getAllByCharacter = vi.fn().mockReturnValueOnce(of([item]))
      .mockReturnValueOnce(throwError(() => ({status:500}))).mockReturnValue(of([item]));
    TestBed.configureTestingModule({providers:[
      {provide:ActivatedRoute,useValue:{parent:{snapshot:{paramMap:convertToParamMap({id:'c'})}}}},
      {provide:Router,useValue:{navigate:vi.fn()}},
      {provide:MatSnackBar,useValue:{open:vi.fn()}},
      {provide:MatDialog,useValue:{open:()=>({afterClosed:()=>of(true)})}},
      {provide:InventoryService,useValue:{getAllByCharacter,delete:()=>throwError(()=>({status:500}))}},
    ]});
    const component=TestBed.runInInjectionContext(()=>new InventoryListComponent());
    component.ngOnInit();
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
