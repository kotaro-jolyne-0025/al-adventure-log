import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { of, Subject, throwError } from 'rxjs';
import { InventoryConsumeDialogComponent, InventoryConsumeDialogData } from './inventory-consume-dialog.component';
import { InventoryService } from '../../../core/services/inventory.service';
import { AdventureService } from '../../../core/services/adventure.service';
import { InventoryMovement } from '../../../core/models/inventory.model';

describe('Inventory consume dialog', () => {
  const item = {id:'i',characterId:'c',itemName:'Potion',itemType:'CONSUMABLE' as const,quantity:5,updatedAt:'original'};
  let data: InventoryConsumeDialogData;
  let service: { consume: ReturnType<typeof vi.fn>; updateUsage: ReturnType<typeof vi.fn> };
  let dialog: { close: ReturnType<typeof vi.fn>; disableClose: boolean };
  beforeEach(() => {
    data={characterId:'c',item,canWrite:()=>true};
    service={consume:vi.fn(),updateUsage:vi.fn()};dialog={close:vi.fn(),disableClose:false};
    TestBed.configureTestingModule({providers:[
      {provide:MAT_DIALOG_DATA,useValue:data},{provide:MatDialogRef,useValue:dialog},
      {provide:InventoryService,useValue:service},{provide:AdventureService,useValue:{getAllByCharacter:()=>of([])}},
    ]});
  });
  const create=()=>TestBed.runInInjectionContext(()=>new InventoryConsumeDialogComponent());

  it('validates whole positive stock quantities and cancel writes nothing', () => {
    const c=create();
    for(const n of [0,-1,1.5,6]){c.quantity=n;c.submit();}
    expect(service.consume).not.toHaveBeenCalled();expect(c.error()).toContain('正整數');
    c.close();expect(dialog.close).toHaveBeenCalledWith(false);
  });
  it('prevents double submit and retains input on failure', () => {
    const result=new Subject();service.consume.mockReturnValue(result);
    const c=create();c.quantity=2;c.notes='memo';c.submit();c.submit();
    expect(service.consume).toHaveBeenCalledTimes(1);expect(dialog.disableClose).toBe(true);
    result.error({status:500});expect(c.quantity).toBe(2);expect(c.notes).toBe('memo');expect(c.pending()).toBe(false);
  });
  it('does not automatically replace a stale token or permit readonly writes', () => {
    service.consume.mockReturnValue(throwError(()=>({status:409,error:{message:'Conflict'}})));
    const c=create();c.submit();c.submit();expect(service.consume).toHaveBeenCalledTimes(1);expect(c.conflict()).toBe(true);
    data.canWrite=()=>false;c.conflict.set(false);c.submit();expect(service.consume).toHaveBeenCalledTimes(1);
  });
  it('edits an association without consuming again', () => {
    delete data.item;data.movement={id:'m',usageEntryId:null} as InventoryMovement;
    service.updateUsage.mockReturnValue(of({}));const c=create();c.submit();
    expect(service.consume).not.toHaveBeenCalled();expect(service.updateUsage).toHaveBeenCalledWith('c',data.movement,undefined,'');
    expect(dialog.close).toHaveBeenCalledWith(true);
  });

  it('prefills shared notes and preserves an edit after a conflict without resubmitting', () => {
    delete data.item;data.movement={id:'m',usageEntryId:null,notes:'Original note'} as InventoryMovement;
    service.updateUsage.mockReturnValue(throwError(()=>({status:409,error:{message:'Conflict'}})));
    const c=create();expect(c.notes).toBe('Original note');c.notes='New note';c.submit();c.submit();
    expect(service.updateUsage).toHaveBeenCalledExactlyOnceWith('c',data.movement,undefined,'New note');
    expect(c.notes).toBe('New note');expect(c.conflict()).toBe(true);expect(dialog.close).not.toHaveBeenCalled();
  });

  it('renders an editable note field for records, clears it, and rejects oversized input', () => {
    delete data.item;data.movement={id:'m',usageEntryId:null,notes:'Original note'} as InventoryMovement;
    service.updateUsage.mockReturnValue(of({}));
    const fixture=TestBed.createComponent(InventoryConsumeDialogComponent);fixture.detectChanges();
    const c=fixture.componentInstance;
    expect(fixture.nativeElement.querySelector('textarea[name="notes"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('編輯紀錄');
    c.notes='x'.repeat(2001);c.submit();expect(service.updateUsage).not.toHaveBeenCalled();
    c.notes='';c.submit();expect(service.updateUsage).toHaveBeenCalledExactlyOnceWith('c',data.movement,undefined,'');
  });
});
