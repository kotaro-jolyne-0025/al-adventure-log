import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { AdventureService } from '../../../core/services/adventure.service';
import { InventoryService } from '../../../core/services/inventory.service';
import { AdventureDetailComponent } from './adventure-detail.component';

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
