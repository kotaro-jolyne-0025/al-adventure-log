import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Observable, Subject } from 'rxjs';
import { InventoryService } from './inventory.service';
import { CharacterService } from './character.service';
import { InventoryItem, InventoryMovement } from '../models/inventory.model';

describe('Inventory history writes and cache', () => {
  let service: InventoryService;
  let http: HttpTestingController;
  let invalidated: Subject<string | undefined>;
  let notify: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    invalidated = new Subject();
    notify = vi.fn(id => invalidated.next(id));
    TestBed.configureTestingModule({providers: [provideHttpClient(), provideHttpClientTesting(),
      {provide: CharacterService, useValue: { cacheInvalidated$: invalidated, notifyCharacterChanged: notify }}]});
    service = TestBed.inject(InventoryService); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('sends the original microsecond token and invalidates history before success observers', () => {
    service.movements('c').subscribe();
    http.expectOne(r => r.url.endsWith('/inventory/movements')).flush({items:[],nextCursor:null});
    const item = {id:'i',updatedAt:'2026-11-07T10:00:00.123456'} as InventoryItem;
    service.consume('c', item, 2, '', null).subscribe(() => service.movements('c').subscribe());
    const request = http.expectOne(r => r.url.endsWith('/i/consume'));
    expect(request.request.headers.get('X-Expected-Updated-At')).toBe(item.updatedAt);
    expect(request.request.body).toEqual({quantity:2,notes:'',usageAdventureEntryId:null});
    request.flush({});
    expect(notify).toHaveBeenCalledWith('c');
    http.expectOne(r => r.url.endsWith('/inventory/movements')).flush({items:[],nextCursor:null});
  });

  it('cancels all character pages on adventure changes and all accounts on logout', () => {
    const stale = vi.fn();
    service.movements('c').subscribe(stale);
    const first = http.expectOne(r => r.url.endsWith('/movements'));
    service.movements('c', 'cursor').subscribe(stale);
    const page = http.expectOne(r => r.params.get('cursor') === 'cursor');
    invalidated.next('c');
    expect(first.cancelled).toBe(true); expect(page.cancelled).toBe(true); expect(stale).not.toHaveBeenCalled();
    service.movements('d').subscribe(stale);
    const other = http.expectOne(r => r.url.endsWith('/movements'));
    invalidated.next(undefined); expect(other.cancelled).toBe(true);
  });

  it('uses an explicit null to clear usage, and never silently retries a conflict', () => {
    const m = {id:'m',updatedAt:'2026-11-07T10:00:00.123456'} as InventoryMovement;
    const error = vi.fn();
    service.updateUsage('c',m,null).subscribe({error});
    const req=http.expectOne(r=>r.method==='PATCH');
    expect(req.request.body).toEqual({usageAdventureEntryId:null});
    req.flush({message:'Conflict'}, {status:409,statusText:'Conflict'});
    expect(error).toHaveBeenCalled(); expect(notify).not.toHaveBeenCalled();
    http.expectNone(r=>r.method==='PATCH');
  });

  it('updates or clears the same movement notes with its original token and invalidates both views', () => {
    const movement={id:'m',updatedAt:'2026-11-10T12:00:00.123456'} as InventoryMovement;
    for(const notes of ['Edited note','']) {
      service.updateUsage('c',movement,'a',notes).subscribe();
      const request=http.expectOne(r=>r.method==='PATCH');
      expect(request.request.body).toEqual({usageAdventureEntryId:'a',notes});
      expect(request.request.headers.get('X-Expected-Updated-At')).toBe(movement.updatedAt);
      request.flush({...movement,notes});
    }
    expect(notify).toHaveBeenCalledTimes(2);
    http.expectNone(r=>r.method==='POST');
  });

  it('omits unchanged usage when editing notes, preserving deleted adventure context', () => {
    service.updateUsage('c',{id:'m',updatedAt:'token'} as InventoryMovement,undefined,'New note').subscribe();
    const request=http.expectOne(r=>r.method==='PATCH');
    expect(request.request.body).toEqual({notes:'New note'});request.flush({});
  });

  it('keeps character, adventure, reversal state and cursor caches separate', () => {
    const scopes = [undefined, {usageAdventureEntryId:'a',reversed:false},
      {usageAdventureEntryId:'a',reversed:true}, {usageAdventureEntryId:'b',reversed:false}];
    for (const scope of scopes) {
      const received = vi.fn();
      service.movements('c','same-cursor',false,scope).subscribe(received);
      const req=http.expectOne(r=>r.url.endsWith('/movements'));
      expect(req.request.params.get('cursor')).toBe('same-cursor');
      expect(req.request.params.get('usageAdventureEntryId')).toBe(scope?.usageAdventureEntryId ?? null);
      expect(req.request.params.get('reversed')).toBe(scope ? String(scope.reversed) : null);
      req.flush({items:[{id:scope?.usageAdventureEntryId ?? 'all', reversed:scope?.reversed}],nextCursor:null});
      service.movements('c','same-cursor',false,scope).subscribe(received);
      expect(received).toHaveBeenCalledTimes(2);
      http.expectNone(r=>r.url.endsWith('/movements'));
    }
    service.movements('other','same-cursor',false,scopes[1]).subscribe();
    http.expectOne(r=>r.url.includes('/other/')).flush({items:[],nextCursor:null});
  });

  it.each(['consume','move','clear','reverse'])('invalidates all scoped pages before %s success is observed', action => {
    const scopes = [{usageAdventureEntryId:'a',reversed:false},{usageAdventureEntryId:'a',reversed:true},
      {usageAdventureEntryId:'b',reversed:false}];
    const late=vi.fn();
    const oldRequests=scopes.map(scope=>{
      service.movements('c','old',false,scope).subscribe(late);
      return http.expectOne(r=>r.url.endsWith('/movements'));
    });
    const movement={id:'m',updatedAt:'original-token'} as InventoryMovement;
    const request: Observable<unknown>=action==='consume' ? service.consume('c',{id:'i',updatedAt:'token'} as InventoryItem,1,'','a')
      : action==='reverse' ? service.reverse('c',movement)
      : service.updateUsage('c',movement,action==='clear'?null:'b');
    request.subscribe(()=>{
      expect(oldRequests.every(r=>r.cancelled)).toBe(true);
      for(const scope of scopes) service.movements('c',null,false,scope).subscribe();
    });
    http.expectOne(r=>r.method!=='GET').flush({});
    const refreshed=http.match(r=>r.url.endsWith('/movements'));
    expect(refreshed.length).toBe(3);
    refreshed.forEach(r=>{expect(r.request.params.has('cursor')).toBe(false);r.flush({items:[],nextCursor:null});});
    expect(late).not.toHaveBeenCalled();
  });
});
