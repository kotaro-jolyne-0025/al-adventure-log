import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of, Subject } from 'rxjs';
import { AdventureDetailComponent } from './adventure-detail.component';
import { LocalReadCache, ReadResult } from '../../../core/services/local-read-cache.service';
import { LocalStore } from '../../../core/services/local-store.service';
import { AdventureService } from '../../../core/services/adventure.service';
import { InventoryService } from '../../../core/services/inventory.service';

it('keeps rendered detail mutation buttons disabled during refresh and after copy fallback', async () => {
  const data = { entry: { id: 'e', adventureName: 'Adventure', downtimeActivities: [] }, gainedItems: [], storyAwards: [], legacyItems: [] };
  const refresh = new Subject<ReadResult<typeof data>>();
  const read = vi.fn().mockReturnValueOnce(of({ data, source: 'cloud', fetchedAt: 200 })).mockReturnValue(refresh);
  const snapshot = { paramMap: convertToParamMap({ id: 'c', entryId: 'e' }) };
  TestBed.configureTestingModule({ imports: [AdventureDetailComponent], providers: [
    provideRouter([]),
    { provide: ActivatedRoute, useValue: { snapshot, parent: { snapshot } } },
    { provide: MatDialog, useValue: {} }, { provide: MatSnackBar, useValue: {} },
    { provide: LocalReadCache, useValue: { read } },
    { provide: AdventureService, useValue: {} }, { provide: InventoryService, useValue: {} },
  ] });
  TestBed.inject(LocalStore).markFresh('c', true);
  const fixture = TestBed.createComponent(AdventureDetailComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  const button = () => fixture.nativeElement.querySelector('.btn-edit') as HTMLButtonElement;
  expect(button().disabled).toBe(false);
  fixture.componentInstance['loadEntry']();
  await fixture.whenStable();
  expect(button().disabled).toBe(true);
  refresh.next({ data, source: 'copy', fetchedAt: 100 });
  refresh.complete();
  await fixture.whenStable();
  expect(button().disabled).toBe(true);
  expect(fixture.nativeElement.textContent).toContain('目前顯示上次查看的資料');
});
