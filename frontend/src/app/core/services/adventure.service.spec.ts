import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Subject } from 'rxjs';
import { AdventureService } from './adventure.service';
import { CharacterService } from './character.service';
import { AdventureEntry } from '../models/adventure.model';
import { environment } from '../../../environments/environment';

describe('Adventure API consistency', () => {
  let api: AdventureService;
  let http: HttpTestingController;
  const stamp = '2026-10-14T01:02:03.123456';
  const details: AdventureEntry = { id: 'e', characterId: 'c', playDate: '2026-10-14',
    updatedAt: stamp, downtimeActivities: [], storyAwards: [], gainedItems: [], legacyItems: [] };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(),
      { provide: CharacterService, useValue: { cacheInvalidated$: new Subject(), notifyCharacterChanged: vi.fn() } },
    ] });
    api = TestBed.inject(AdventureService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());

  it('loads the complete editing snapshot with exactly one GET', () => {
    const result = vi.fn();
    api.getDetails('c', 'e').subscribe(result);
    http.expectOne(`${environment.apiUrl}/entries/e`).flush(details);
    expect(result).toHaveBeenCalledWith({
      entry: { id: 'e', characterId: 'c', playDate: '2026-10-14', updatedAt: stamp,
        downtimeActivities: [], storyAwards: [] },
      gainedItems: [], storyAwards: [], legacyItems: [],
    });
    http.expectNone(request => request.url.includes('gained-items') || request.url.includes('story-awards') || request.url.includes('inventory'));
  });

  it.each([
    { ...details, updatedAt: undefined },
    { ...details, storyAwards: undefined },
    { ...details, gainedItems: undefined },
    { ...details, legacyItems: undefined },
    { ...details, characterId: 'another-character' },
  ])('rejects an incomplete or wrong-character editing response', response => {
    const next = vi.fn(), error = vi.fn();
    api.getDetails('c', 'e').subscribe({ next, error });
    http.expectOne(`${environment.apiUrl}/entries/e`).flush(response);
    expect(next).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledOnce();
  });

  it('sends the original token with a full save and makes no pre-save read', () => {
    api.updateWithDetails('c', 'e', { entry: { playDate: '2026-10-14' },
      downtimeActivities: [], gainedItems: [], storyAwards: [], expectedUpdatedAt: stamp }).subscribe();
    const request = http.expectOne(`${environment.apiUrl}/entries/e/with-details`);
    expect(request.request.method).toBe('PUT');
    expect(request.request.headers.get('X-Expected-Updated-At')).toBe(stamp);
    expect(request.request.body).not.toHaveProperty('expectedUpdatedAt');
    http.expectNone(request => request.method === 'GET');
    request.flush(details);
  });

  it('sends the displayed token with delete and propagates a conflict without retrying', () => {
    const error = vi.fn();
    api.delete('c', 'e', stamp).subscribe({ error });
    const request = http.expectOne(`${environment.apiUrl}/entries/e`);
    expect(request.request.method).toBe('DELETE');
    expect(request.request.headers.get('X-Expected-Updated-At')).toBe(stamp);
    request.flush({ message: 'Conflict' }, { status: 409, statusText: 'Conflict' });
    expect(error).toHaveBeenCalledOnce();
  });
});
