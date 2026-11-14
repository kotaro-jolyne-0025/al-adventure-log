import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, Subject, throwError } from 'rxjs';
import { InventoryHistoryComponent } from './inventory-history.component';
import { InventoryService } from '../../../core/services/inventory.service';
import { InventoryMovement } from '../../../core/models/inventory.model';
import { LocalStore } from '../../../core/services/local-store.service';

describe('Inventory history tab', () => {
  const movement = {id:'m',itemName:'Empty potion',operation:'CONSUME',quantityBefore:1,quantityDelta:-1,quantityAfter:0,
    reversible:true,reversed:false,createdAt:'2026-11-07T01:00:00',updatedAt:'token'} as InventoryMovement;
  let service: {movements: ReturnType<typeof vi.fn>; reverse: ReturnType<typeof vi.fn>};
  let dialog: {open: ReturnType<typeof vi.fn>};
  beforeEach(() => {
    service={movements:vi.fn().mockReturnValue(of({items:[movement],nextCursor:'older'})),reverse:vi.fn()};
    dialog={open:vi.fn().mockReturnValue({afterClosed:()=>of(false)})};
    TestBed.configureTestingModule({providers:[provideRouter([]),
      {provide:InventoryService,useValue:service},{provide:MatDialog,useValue:dialog},{provide:MatSnackBar,useValue:{open:vi.fn()}}]});
  });
  function create(readonly=false, adventure?:string) {
    const fixture=TestBed.createComponent(InventoryHistoryComponent);
    fixture.componentRef.setInput('characterId','c');fixture.componentRef.setInput('readOnly',readonly);
    if(adventure) fixture.componentRef.setInput('usageAdventureEntryId',adventure);
    fixture.detectChanges();return fixture;
  }
  it.each([undefined,'a'])('refreshes automatically on return without a refresh button in scope %s', adventure => {
    const fixture=create(false,adventure);
    expect(fixture.nativeElement.querySelector('.history-toolbar')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('重新整理');
    service.movements.mockClear();
    const visibility=vi.spyOn(document,'visibilityState','get').mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(service.movements).toHaveBeenCalledTimes(1);
    expect(service.movements.mock.calls[0][1]).toBeNull();
    visibility.mockRestore();
  });
  it('shows exhausted items, historical balances, and paginated history independently of item search', () => {
    const fixture=create();
    expect(fixture.nativeElement.textContent).toContain('Empty potion');
    const row: HTMLElement = fixture.nativeElement.querySelector('li');
    const disclosure = row.querySelector('details')!;
    expect(disclosure.open).toBe(false);
    expect(row.querySelector('summary')?.textContent).toMatch(/Empty potion\s*消耗\s*-1 個/);
    disclosure.open = true;
    expect(row.querySelector('.balances')?.textContent).toMatch(/原有1 個\s*剩餘0 個/);
    expect(fixture.nativeElement.textContent).not.toContain('現在還有');
    service.movements.mockReturnValue(of({items:[{...movement,id:'old'}, {...movement,id:'older',createdAt:'2026-11-06T23:00:00'}],nextCursor:null}));
    fixture.componentInstance.load(true);fixture.detectChanges();
    expect(service.movements).toHaveBeenLastCalledWith('c','older',true);
    expect(fixture.componentInstance.rows().length).toBe(3);
    const items: NodeListOf<HTMLElement> = fixture.nativeElement.querySelectorAll('ol > li');
    expect(items.length).toBe(3);
    expect(Array.from(items, item => item.querySelector('.movement-detail time')?.textContent?.trim())).toEqual([
      '記錄於 2026/11/07 01:00:00', '記錄於 2026/11/07 01:00:00', '記錄於 2026/11/06 23:00:00',
    ]);
    expect(Array.from(items, item => item.querySelector('.day-group')?.textContent?.trim())).toEqual([
      '2026/11/07', undefined, '2026/11/06',
    ]);
    expect(fixture.nativeElement.textContent).not.toContain('載入更多');
  });
  it('distinguishes usage adventure from acquisition source and hides baselines', () => {
    service.movements.mockReturnValue(of({items:[
      {...movement,usageOriginalEntryId:'a',usageEntryId:'a',usageName:'Used adventure',sourceName:'Source adventure',notes:'Player note'},
      {...movement,id:'b',operation:'BASELINE',quantityDelta:2,quantityAfter:2},
      {...movement,id:'c',operation:'BASELINE',quantityDelta:1,quantityAfter:1},
    ],nextCursor:null}));
    const fixture=create();
    const root: HTMLElement=fixture.nativeElement;
    expect(root.textContent).toContain('使用冒險：');
    expect(root.textContent).toContain('Used adventure');
    expect(root.querySelector('.movement-detail')?.textContent).toContain('取得來源：Source adventure');
    expect(root.querySelector('.notes')?.textContent).toBe('Player note');
    expect(root.querySelector('[aria-label="Empty potion的紀錄操作"]')).not.toBeNull();
    expect(root.querySelectorAll('.baseline-note').length).toBe(0);
    expect(root.querySelectorAll('li').length).toBe(1);
    expect(root.querySelector('.record-menu')).not.toBeNull();
  });
  it('shows an empty history for baseline-only stock without removing the stock', () => {
    service.movements.mockReturnValue(of({items:[{...movement,operation:'BASELINE'}],nextCursor:null}));
    const fixture=create();
    expect(fixture.nativeElement.querySelectorAll('li').length).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('尚無異動紀錄。');
    expect(fixture.nativeElement.textContent).not.toContain('不包含過往使用歷史');
    expect(service.reverse).not.toHaveBeenCalled();
  });

  it.each([undefined,'a'])('hides both reversal rows from older API responses while retaining pagination in scope %s', adventure => {
    service.movements.mockReturnValue(of({items:[
      {...movement,id:'reversed',reversed:true},
      {...movement,id:'restored',operation:'REVERSE',quantityDelta:1},
    ],nextCursor:'older'}));
    const fixture=create(false,adventure);
    expect(fixture.componentInstance.rows()).toEqual([]);
    expect(fixture.componentInstance.cursor()).toBe('older');
    expect(fixture.nativeElement.textContent).not.toContain('尚無異動紀錄。');
    expect(fixture.nativeElement.querySelectorAll('li').length).toBe(0);
    service.movements.mockReturnValue(of({items:[{...movement,id:'active'}],nextCursor:null}));
    fixture.componentInstance.load(true);fixture.detectChanges();
    expect(fixture.componentInstance.rows().map(m=>m.id)).toEqual(['active']);
    expect(fixture.nativeElement.querySelectorAll('li').length).toBe(1);
  });
  it('retains displayed history on temporary errors, but clears it on access failure', () => {
    const fixture=create();
    service.movements.mockReturnValue(throwError(()=>({status:500})));
    fixture.componentInstance.load(true);expect(fixture.componentInstance.rows().length).toBe(1);
    expect(fixture.componentInstance.error()).toContain('重試');
    service.movements.mockReturnValue(throwError(()=>({status:403})));
    fixture.componentInstance.load();expect(fixture.componentInstance.rows()).toEqual([]);
  });
  it('blocks readonly and ineligible actions before opening dialogs', () => {
    const fixture=create(true);fixture.componentInstance.reverse(movement);fixture.componentInstance.editUsage(movement);
    expect(dialog.open).not.toHaveBeenCalled();
    fixture.componentRef.setInput('readOnly',false);fixture.detectChanges();
    fixture.componentInstance.reverse({...movement,reversible:false});expect(dialog.open).not.toHaveBeenCalled();
    fixture.componentInstance.reverse(movement);expect(dialog.open).toHaveBeenCalledTimes(1);expect(service.reverse).not.toHaveBeenCalled();
  });
  it.each([undefined,'a'])('opens the record menu independently of disclosure in scope %s', adventure => {
    const fixture = create(false, adventure);
    const root: HTMLElement = fixture.nativeElement;
    const trigger = root.querySelector<HTMLButtonElement>('.record-menu')!;
    const disclosure = root.querySelector('details')!;
    fixture.componentInstance.rows.set([{ ...movement, reversible: false }]);
    fixture.detectChanges();
    trigger.click();
    fixture.detectChanges();
    const items = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
    expect(items.map(item => item.textContent?.trim())).toEqual(['編輯', '撤銷消耗']);
    expect(items[1].disabled).toBe(true);
    expect(disclosure.open).toBe(false);
    items[0].click();
    expect(dialog.open).toHaveBeenCalledTimes(1);
    fixture.componentInstance.busy.set(true);
    fixture.detectChanges();
    expect(trigger.disabled).toBe(true);
    fixture.componentInstance.busy.set(false);
    fixture.componentRef.setInput('readOnly', true);
    fixture.detectChanges();
    expect(trigger.disabled).toBe(true);
  });
  it('does not overwrite a newer refresh with a late response', () => {
    const fixture=create();const first=new Subject<any>(),second=new Subject<any>();
    service.movements.mockReturnValueOnce(first).mockReturnValueOnce(second);
    fixture.componentInstance.load();fixture.componentInstance.load();
    second.next({items:[{...movement,id:'latest'}],nextCursor:null});
    first.next({items:[movement],nextCursor:null});
    expect(fixture.componentInstance.rows()[0].id).toBe('latest');
    first.complete();second.complete();
  });

  it('shows individual adventure uses with source and quantity, with actions outside note details', () => {
    service.movements.mockReturnValue(of({items:[
      {...movement,id:'one',itemId:'i',sourceName:'Source A'},
      {...movement,id:'two',itemId:'i',sourceName:'Source A'},
      {...movement,id:'three',itemId:'j',sourceName:'Source B',reversible:false},
    ],nextCursor:'active-page'}));
    const fixture=create(false,'used-in');
    expect(service.movements).toHaveBeenLastCalledWith('c',null,true,{usageAdventureEntryId:'used-in',reversed:false});
    const root:HTMLElement=fixture.nativeElement;
    expect(root.querySelectorAll('li').length).toBe(3);
    expect(root.querySelector('.day-group')).toBeNull();
    const main=root.querySelector('summary')!;
    expect(main.textContent).not.toContain('Source A');
    expect(main.textContent).toMatch(/消耗\s*-1 個/);
    expect(root.querySelector('.movement-detail')?.textContent).toContain('Source A');
    expect(main.textContent).not.toContain('剩下');expect(main.querySelector('time')).toBeNull();
    expect(root.querySelector('details')?.open).toBe(false);
    expect(root.querySelector('.record-menu')).not.toBeNull();
    expect(root.textContent).not.toContain('原本有');
    expect(root.textContent).not.toContain('使用冒險：');
    fixture.componentInstance.load(true);
    expect(service.movements).toHaveBeenLastCalledWith('c','active-page',true,{usageAdventureEntryId:'used-in',reversed:false});
  });

  it.each([undefined,'a'])('shows notes only in details and omits blank notes in scope %s', adventure => {
    service.movements.mockReturnValue(of({items:[
      {...movement,id:'note',notes:'Helped a teammate\nDuring the final fight',reason:'SOURCE_CORRECTION',previousItemType:'PERMANENT',itemType:'CONSUMABLE'},
      ...[undefined,null,'',' \n\t'].map((notes,index)=>({...movement,id:'blank-'+index,notes})),
    ],nextCursor:null}));
    const fixture=create(false,adventure);
    const root:HTMLElement=fixture.nativeElement;
    expect(root.querySelectorAll('details:not([open])').length).toBe(5);
    expect(root.querySelector('summary')?.textContent).not.toContain('Helped a teammate');
    expect(root.querySelectorAll('.notes').length).toBe(1);
    expect(root.querySelector('.notes')?.textContent).toBe('Helped a teammate\nDuring the final fight');
    expect(root.textContent).not.toContain('查看詳情');
    expect(root.textContent).not.toContain('來源更正');
    expect(root.textContent).not.toContain('原本有');
    expect(root.querySelectorAll('.record-menu').length).toBe(5);
    expect(root.querySelectorAll('li > time').length).toBe(0);
  });

  it('resets pagination on invalidation and ignores old adventure and account responses', () => {
    const fixture=create(false,'a');
    const old=new Subject<any>();service.movements.mockReturnValueOnce(old);
    fixture.componentInstance.load(true);
    fixture.componentRef.setInput('usageAdventureEntryId','b');fixture.detectChanges();
    expect(service.movements).toHaveBeenLastCalledWith('c',null,true,{usageAdventureEntryId:'b',reversed:false});
    old.next({items:[{...movement,id:'old-a'}],nextCursor:'wrong'});
    expect(fixture.componentInstance.rows().some(m=>m.id==='old-a')).toBe(false);
    const pending=new Subject<any>();service.movements.mockReturnValueOnce(pending);fixture.componentInstance.load();
    TestBed.inject(LocalStore).setOwner('different-account');
    pending.next({items:[movement],nextCursor:'stale'});
    expect(fixture.componentInstance.rows()).toEqual([]);expect(fixture.componentInstance.cursor()).toBeNull();
    old.complete();pending.complete();
  });

  it('refreshes and focuses the section when editing moves a row out of the adventure', () => {
    const fixture=create(false,'a');
    const close=new Subject<boolean>();dialog.open.mockReturnValue({afterClosed:()=>close});
    fixture.componentInstance.editUsage(movement);
    const data=dialog.open.mock.calls[0][1].data;
    expect(data.movement).toBe(movement);
    fixture.componentRef.setInput('readOnly',true);fixture.detectChanges();expect(data.canWrite()).toBe(false);
    fixture.componentRef.setInput('readOnly',false);fixture.detectChanges();
    service.movements.mockReturnValue(of({items:[],nextCursor:null}));close.next(true);fixture.detectChanges();
    expect(fixture.componentInstance.rows()).toEqual([]);
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('section'));
    close.complete();
  });

  it.each([undefined,'a'])('removes the undone row and preserves focus without a revision row in scope %s', adventure => {
    const fixture=create(false,adventure);
    dialog.open.mockReturnValue({afterClosed:()=>of(true)});
    const response=new Subject<any>();service.reverse.mockReturnValue(response);
    fixture.componentInstance.reverse(movement);fixture.componentInstance.reverse(movement);
    expect(dialog.open.mock.calls[0][1].data.message).toBe('撤銷後會補回本次消耗數量，並從畫面移除這次登記。是否繼續？');
    expect(service.reverse).toHaveBeenCalledExactlyOnceWith('c',movement);
    service.movements.mockReturnValue(of({items:[],nextCursor:null}));response.next(movement);fixture.detectChanges();
    expect(fixture.componentInstance.rows()).toEqual([]);expect(fixture.componentInstance.busy()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('尚無異動紀錄。');
    expect(fixture.nativeElement.textContent).not.toContain('已撤銷的登記');
    expect(fixture.nativeElement.querySelectorAll('li').length).toBe(0);
    expect(document.activeElement).toBe(fixture.nativeElement.querySelector('section'));
    response.complete();
  });

  it('disables an open association dialog after its history view is destroyed', () => {
    const fixture=create(false,'a');
    const close=new Subject<boolean>();dialog.open.mockReturnValue({afterClosed:()=>close});
    fixture.componentInstance.editUsage(movement);
    const data=dialog.open.mock.calls[0][1].data;
    expect(data.canWrite()).toBe(true);fixture.destroy();expect(data.canWrite()).toBe(false);
    close.complete();
  });
});
