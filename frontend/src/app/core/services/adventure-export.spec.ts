import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Subject } from 'rxjs';
import { AdventureService } from './adventure.service';
import { CharacterService } from './character.service';
import { LocalStore } from './local-store.service';
import { environment } from '../../../environments/environment';

describe('Character exports', () => {
  let api: AdventureService, http: HttpTestingController, local: LocalStore;
  let invalidated: Subject<string | undefined>;
  beforeEach(() => {
    invalidated = new Subject();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: CharacterService, useValue: { cacheInvalidated$: invalidated } },
    ] });
    api = TestBed.inject(AdventureService); http = TestBed.inject(HttpTestingController);
    local = TestBed.inject(LocalStore); local.setOwner('owner');
  });
  afterEach(() => http.verify());
  const url = `${environment.apiUrl}/characters/c/exports?format=pdf`;

  it('fetches a fresh Blob each time and preserves the server UTF8 filename', () => {
    const next = vi.fn();
    for (let i = 0; i < 2; i++) {
      api.export('c', 'pdf').subscribe(next);
      const request = http.expectOne(url);
      expect(request.request.responseType).toBe('blob');
      request.flush(new Blob(['%PDF'], { type: 'application/pdf' }), { headers: { 'Content-Disposition': "attachment; filename*=UTF-8''%E8%A7%92%E8%89%B2.pdf" } });
    }
    expect(next).toHaveBeenCalledTimes(2);
    expect(next.mock.calls[0][0].filename).toBe('角色.pdf');
  });
  it.each(['session', 'character', 'local'] as const)('cancels a pending request on %s invalidation', kind => {
    const next = vi.fn(), complete = vi.fn();
    api.export('c', 'pdf').subscribe({ next, complete });
    const request = http.expectOne(url);
    if (kind === 'session') local.setOwner('another');
    else if (kind === 'character') invalidated.next('c');
    else local.changes.next('c');
    expect(request.cancelled).toBe(true); expect(next).not.toHaveBeenCalled(); expect(complete).toHaveBeenCalledOnce();
  });
  it('ignores unrelated notifications but discards changed generations', () => {
    const next = vi.fn(); api.export('c', 'pdf').subscribe(next); const request = http.expectOne(url);
    invalidated.next('other'); expect(request.cancelled).toBe(false);
    local.invalidate('other', null, false);
    request.flush(new Blob(['%PDF'], { type: 'application/pdf' })); expect(next).not.toHaveBeenCalled();
  });
  it('rejects successful JSON responses instead of downloading them', () => {
    const error = vi.fn(); api.export('c', 'pdf').subscribe({ error });
    http.expectOne(url).flush(new Blob(['{"message":"error"}'], { type: 'application/json' }));
    expect(error).toHaveBeenCalledOnce();
  });
  it.each(['logout', 'generation'])('reads JSON Blob errors and drops stale asynchronous errors after %s', async kind => {
    const error = vi.fn(); api.export('c', 'pdf').subscribe({ error });
    const blob = new Blob([], { type: 'application/json' });
    let resolve!: (value: string) => void;
    vi.spyOn(blob, 'text').mockReturnValue(new Promise(r => resolve = r));
    http.expectOne(url).flush(blob, { status: 400, statusText: 'Bad Request' });
    if (kind === 'logout') local.setOwner(null);
    else local.invalidate('other', null, false);
    resolve('{"message":"舊訊息"}');
    await Promise.resolve(); expect(error).not.toHaveBeenCalled();
    local.setOwner('owner');
    api.export('c', 'pdf').subscribe({ error });
    const failure = new Blob([], { type: 'application/json' });
    vi.spyOn(failure, 'text').mockResolvedValue('{"message":"尚無冒險紀錄可匯出"}');
    http.expectOne(url).flush(failure, { status: 400, statusText: 'Bad Request' });
    await Promise.resolve();
    expect(error.mock.calls[0][0].message).toBe('尚無冒險紀錄可匯出');
  });
});
