import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { InventoryService } from '../../../core/services/inventory.service';
import { InventoryItem } from '../../../core/models/inventory.model';
import { InventoryFormComponent } from './inventory-form.component';

describe('Inventory edit initialization', () => {
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
});
