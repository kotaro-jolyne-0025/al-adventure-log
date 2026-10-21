import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { BehaviorSubject, of, Subject } from 'rxjs';
import { AdventureListComponent } from './adventure-list.component';
import { AdventureService } from '../../../core/services/adventure.service';
import { LocalReadCache } from '../../../core/services/local-read-cache.service';
import { LocalStore } from '../../../core/services/local-store.service';

describe('Adventure export controls', () => {
  let params: BehaviorSubject<ReturnType<typeof convertToParamMap>>;
  let response: Subject<{ blob: Blob; filename: string }>;
  let exports: ReturnType<typeof vi.fn>;
  let local: LocalStore;
  const entry = { id: 'entry', characterId: 'c', adventureName: '試作紀錄', playDate: '2026-10-18' };
  beforeEach(() => {
    vi.useFakeTimers();
    params = new BehaviorSubject(convertToParamMap({ id: 'c' })); response = new Subject(); exports = vi.fn(() => response);
    vi.stubGlobal('URL', class extends URL {
      static override createObjectURL = vi.fn(() => 'blob:synthetic');
      static override revokeObjectURL = vi.fn();
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    TestBed.configureTestingModule({ imports: [AdventureListComponent], providers: [provideRouter([]),
      { provide: ActivatedRoute, useValue: { parent: { paramMap: params }, snapshot: { paramMap: params.value } } },
      { provide: AdventureService, useValue: { export: exports, getAllByCharacter: () => of([entry]) } },
      { provide: LocalReadCache, useValue: { read: () => of({ data: [entry], source: 'cloud', fetchedAt: Date.now() }) } },
    ] });
    local = TestBed.inject(LocalStore); local.setOwner('owner'); local.markFresh('c', true); local.markFresh('next', true);
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('exports all records despite search, blocks repeat clicks and releases the URL', () => {
    const fixture = TestBed.createComponent(AdventureListComponent); fixture.detectChanges(); const component = fixture.componentInstance;
    component['onSearchChange']('沒有符合');
    component['export']('pdf'); component['export']('xlsx');
    expect(exports).toHaveBeenCalledExactlyOnceWith('c', 'pdf'); expect(component['exportBusy']()).toBe(true);
    response.next({ blob: new Blob(['%PDF']), filename: '試作.pdf' }); response.complete();
    expect(HTMLAnchorElement.prototype.click).toHaveBeenCalledOnce();
    expect(component['exportBusy']()).toBe(false); expect(component['exportMessage']()).toBe('已交付瀏覽器下載。');
    expect(URL.revokeObjectURL).not.toHaveBeenCalled(); vi.advanceTimersByTime(1000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:synthetic'); fixture.destroy();
  });
  it('cancels on character switch and destruction without accepting late files', () => {
    const fixture = TestBed.createComponent(AdventureListComponent); fixture.detectChanges(); const component = fixture.componentInstance;
    component['export']('pdf'); params.next(convertToParamMap({ id: 'next' }));
    response.next({ blob: new Blob(['late']), filename: 'late.pdf' });
    expect(URL.createObjectURL).not.toHaveBeenCalled(); expect(component['exportBusy']()).toBe(false);
    component['export']('xlsx'); expect(exports).toHaveBeenLastCalledWith('next', 'xlsx'); fixture.destroy();
    response.next({ blob: new Blob(['late']), filename: 'late.xlsx' }); expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
  it('allows retry after errors and disables exports for copies, offline state and no records', () => {
    const fixture = TestBed.createComponent(AdventureListComponent); fixture.detectChanges(); const component = fixture.componentInstance;
    component['export']('xlsx'); response.error(new Error('請重試'));
    expect(component['exportBusy']()).toBe(false); expect(component['exportError']()).toBe('請重試');
    response = new Subject(); component['export'](); expect(exports).toHaveBeenLastCalledWith('c', 'xlsx'); response.complete();
    component['online'].set(false); expect(component['exportDisabled']()).toBe(true); component['online'].set(true);
    component['readSource'].set('copy'); expect(component['exportDisabled']()).toBe(true); component['readSource'].set('cloud');
    component['rawEntries'].set([]); component['export']('pdf'); expect(exports).toHaveBeenCalledTimes(2); fixture.destroy();
  });
});
