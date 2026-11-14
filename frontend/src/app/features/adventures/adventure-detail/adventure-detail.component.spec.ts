import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { AdventureService } from '../../../core/services/adventure.service';
import { InventoryService } from '../../../core/services/inventory.service';
import { AdventureDetailComponent } from './adventure-detail.component';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { LocalReadCache } from '../../../core/services/local-read-cache.service';
import { LocalStore } from '../../../core/services/local-store.service';

describe('AdventureDetailComponent', () => {
  it('formats paper-ledger changes and derives the inventory warning count', () => {
    const navigate = vi.fn();
    TestBed.configureTestingModule({ providers: [
      { provide: ActivatedRoute, useValue: {
        parent: { snapshot: { paramMap: convertToParamMap({ id: 'c' }) } },
        snapshot: { paramMap: convertToParamMap({ entryId: 'e' }) },
      } },
      { provide: Router, useValue: { navigate } },
      { provide: MatSnackBar, useValue: { open: vi.fn() } },
      { provide: MatDialog, useValue: { open: vi.fn() } },
      { provide: AdventureService, useValue: {} },
      { provide: InventoryService, useValue: {} },
    ] });
    const component = TestBed.runInInjectionContext(() => new AdventureDetailComponent());
    component['entry'].set({
      id: 'e', characterId: 'c', downtimeActivities: [],
      startingGold: 100, goldChange: 12.5, goldTotal: 112.5,
      magicItemsChange: -1, magicItemsDowntimeChange: -2,
    });

    expect(component['formatChange'](12.5)).toBe('+12.5');
    expect(component['formatChange'](-2)).toBe('-2');
    expect(component['magicItemsReduction']()).toBe(3);
    expect(component['acquisitionSourceLabel']('ADVENTURE')).toBe('冒險獲得');
    expect(component['acquisitionSourceLabel']('DOWNTIME')).toBe('休整期獲得');
    expect(component['acquisitionSourceLabel'](null)).toBe('');
    component['characterId'] = 'c';
    component['onOpenInventory']();
    expect(navigate).toHaveBeenCalledWith(['/characters', 'c', 'inventory']);
  });
});

describe('Adventure consumption history integration', () => {
  const entry = {id:'a',characterId:'c',adventureName:'Usage adventure',downtimeActivities:[]};
  const movement = {id:'m',itemId:'i',itemName:'Potion',sourceName:'Source adventure',operation:'CONSUME',
    quantityBefore:1,quantityDelta:-1,quantityAfter:0,createdAt:'2026-11-09T12:00:00',updatedAt:'token',reversed:false,reversible:true};
  let reads: {read: ReturnType<typeof vi.fn>};
  let inventory: {movements: ReturnType<typeof vi.fn>};
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  beforeEach(()=>{
    params=new BehaviorSubject(convertToParamMap({entryId:'a'}));
    reads={read:vi.fn().mockReturnValue(of({source:'cloud',fetchedAt:1,data:{entry,gainedItems:[],storyAwards:[],legacyItems:[]}}))};
    inventory={movements:vi.fn().mockReturnValue(of({items:[movement],nextCursor:null}))};
    TestBed.configureTestingModule({providers:[
      {provide:ActivatedRoute,useValue:{parent:{paramMap:of(convertToParamMap({id:'c'}))},paramMap:params}},
      {provide:Router,useValue:{navigate:vi.fn(),createUrlTree:vi.fn(),serializeUrl:vi.fn()}},
      {provide:MatSnackBar,useValue:{open:vi.fn()}},{provide:MatDialog,useValue:{open:vi.fn()}},
      {provide:AdventureService,useValue:{}},{provide:InventoryService,useValue:inventory},
      {provide:LocalReadCache,useValue:reads},
    ]});
    TestBed.inject(LocalStore).markFresh('c',true);
  });
  function create(){const f=TestBed.createComponent(AdventureDetailComponent);f.detectChanges();return f;}

  it('loads only active usage and does not offer a reversed history section', ()=>{
    const f=create();
    expect(inventory.movements).toHaveBeenCalledExactlyOnceWith('c',null,true,{usageAdventureEntryId:'a',reversed:false});
    expect(f.nativeElement.textContent).toContain('Usage adventure');
    expect(f.nativeElement.querySelector('.reversed-consumption')).toBeNull();
    expect(f.nativeElement.textContent).not.toContain('已撤銷的登記');
    expect(f.nativeElement.querySelectorAll('app-inventory-history').length).toBe(1);
  });

  it('keeps adventure and gained snapshots on history failure and retries only history', ()=>{
    inventory.movements.mockReturnValue(throwError(()=>({status:500})));
    reads.read.mockReturnValue(of({source:'cloud',fetchedAt:1,data:{entry,gainedItems:[
      {id:'reward',itemName:'Original reward',itemType:'CONSUMABLE',quantity:5}],storyAwards:[],legacyItems:[]}}));
    const f=create();
    expect(f.nativeElement.textContent).toContain('Usage adventure');expect(f.nativeElement.textContent).toContain('Original reward');
    expect(f.nativeElement.querySelector('app-inventory-history').textContent).not.toContain('尚無異動紀錄。');
    inventory.movements.mockReturnValue(of({items:[movement],nextCursor:null}));
    const retry=Array.from(f.nativeElement.querySelectorAll('app-inventory-history button') as NodeListOf<HTMLButtonElement>)
      .find(b=>b.textContent?.includes('重試'))!;
    retry.click();f.detectChanges();
    expect(f.nativeElement.textContent).toContain('Source adventure');expect(reads.read).toHaveBeenCalledTimes(1);
  });

  it('keeps a copied adventure read-only after history succeeds', ()=>{
    reads.read.mockReturnValue(of({source:'copy',fetchedAt:1,data:{entry,gainedItems:[],storyAwards:[],legacyItems:[]}}));
    const f=create();
    const menu = f.nativeElement.querySelector('.record-menu') as HTMLButtonElement;
    expect(menu.disabled).toBe(true);
  });

  it('ignores late details after navigation and removes history when the adventure is deleted', ()=>{
    const old=new Subject<any>();reads.read.mockReturnValueOnce(old);
    const f=create();
    reads.read.mockReturnValue(of({source:'cloud',fetchedAt:1,data:{entry:{...entry,id:'b',adventureName:'New adventure'},gainedItems:[],storyAwards:[],legacyItems:[]}}));
    params.next(convertToParamMap({entryId:'b'}));f.detectChanges();
    old.next({source:'cloud',fetchedAt:1,data:{entry,gainedItems:[],storyAwards:[],legacyItems:[]}});f.detectChanges();
    expect(f.nativeElement.textContent).toContain('New adventure');
    expect(inventory.movements).toHaveBeenLastCalledWith('c',null,true,{usageAdventureEntryId:'b',reversed:false});
    reads.read.mockReturnValue(throwError(()=>({status:404})));
    TestBed.inject(LocalStore).changes.next('c');f.detectChanges();
    expect(f.nativeElement.querySelector('app-inventory-history')).toBeNull();old.complete();
  });
});
