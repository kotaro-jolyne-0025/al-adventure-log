import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CharacterService } from './character.service';
import { AdventureService } from './adventure.service';
import { InventoryService } from './inventory.service';
import { environment } from '../../../environments/environment';
import { Observable } from 'rxjs';

describe('Related data cache invalidation', () => {
  let http: HttpTestingController;
  let characters: CharacterService;
  let adventures: AdventureService;
  let inventory: InventoryService;
  const base = `${environment.apiUrl}/characters`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    characters = TestBed.inject(CharacterService);
    adventures = TestBed.inject(AdventureService);
    inventory = TestBed.inject(InventoryService);
  });
  afterEach(() => http.verify());

  it('carries the original token on every gameplay mutation API', () => {
    const expectedUpdatedAt = '2026-10-14T01:02:03.123456';
    const calls: Array<() => Observable<unknown>> = [
      () => characters.update('c', { characterName: 'Hero', race: 'Human', expectedUpdatedAt }),
      () => characters.delete('c', expectedUpdatedAt),
      () => inventory.create('c', { itemName: 'Sword', itemType: 'PERMANENT', expectedUpdatedAt }),
      () => inventory.update('c', 'i', { itemName: 'Sword', itemType: 'PERMANENT', expectedUpdatedAt }),
      () => inventory.delete('c', 'i', expectedUpdatedAt),
      () => adventures.create('c', { playDate: '2026-10-14', expectedUpdatedAt }),
      () => adventures.createWithDetails('c', { entry: { playDate: '2026-10-14' }, gainedItems: [], storyAwards: [], downtimeActivities: [], expectedUpdatedAt }),
      () => adventures.update('c', 'e', { playDate: '2026-10-14', expectedUpdatedAt }),
      () => adventures.updateWithDetails('c', 'e', { entry: { playDate: '2026-10-14' }, gainedItems: [], storyAwards: [], downtimeActivities: [], expectedUpdatedAt }),
      () => adventures.delete('c', 'e', expectedUpdatedAt),
      () => adventures.addDowntime('e', { description: 'Rest', expectedUpdatedAt }),
      () => adventures.updateDowntime('d', { description: 'Rest', expectedUpdatedAt }),
      () => adventures.deleteDowntime('e', 'd', expectedUpdatedAt),
      () => adventures.addGainedItem('e', { itemName: 'Sword', itemType: 'PERMANENT', expectedUpdatedAt }),
      () => adventures.updateGainedItem('e', 'g', { itemName: 'Sword', itemType: 'PERMANENT', expectedUpdatedAt }),
      () => adventures.deleteGainedItem('g', expectedUpdatedAt),
      () => adventures.addStoryAward('e', { awardName: 'Award', expectedUpdatedAt }),
      () => adventures.updateStoryAward('e', 'a', { awardName: 'Award', expectedUpdatedAt }),
      () => adventures.deleteStoryAward('a', expectedUpdatedAt),
    ];
    for (const call of calls) {
      call().subscribe({ error: () => {} });
      const [request] = http.match(() => true);
      expect(request.request.headers.get('X-Expected-Updated-At')).toBe(expectedUpdatedAt);
      if (request.request.body) expect(request.request.body).not.toHaveProperty('expectedUpdatedAt');
      request.flush({ message: 'Conflict' }, { status: 409, statusText: 'Conflict' });
    }
  });

  it('cancels account A requests and issues a new request for account B', () => {
    const oldReceiver = vi.fn(), receiver = vi.fn();
    characters.getAll().subscribe(oldReceiver);
    const old = http.expectOne(base);
    characters.clearCache();
    expect(old.cancelled).toBe(true);
    characters.getAll().subscribe(receiver);
    http.expectOne(base).flush([{ id: 'B' }]);
    expect(oldReceiver).not.toHaveBeenCalled();
    expect(receiver).toHaveBeenCalledWith([{ id: 'B' }]);
  });

  it('invalidates inventory before the adventure deletion notification reaches HUD', () => {
    inventory.getAllByCharacter('c').subscribe();
    http.expectOne(`${base}/c/inventory`).flush([{ id: 'old-item' }]);
    const hud = vi.fn();
    characters.characterChanged$.subscribe(() => inventory.getAllByCharacter('c').subscribe(hud));
    adventures.delete('c', 'e').subscribe();
    http.expectOne(`${environment.apiUrl}/entries/e`).flush(null);
    expect(hud).not.toHaveBeenCalled();
    http.expectOne(`${base}/c/inventory`).flush([]);
    expect(hud).toHaveBeenCalledWith([]);
  });

  it('refreshes adventure defaults after inventory changes', () => {
    adventures.getDefaults('c').subscribe();
    http.expectOne(`${base}/c/entries/defaults`).flush({ startingMagicItems: 1 });
    inventory.delete('c', 'item').subscribe();
    http.expectOne(`${base}/c/inventory/item`).flush(null);
    const receiver = vi.fn();
    adventures.getDefaults('c').subscribe(receiver);
    http.expectOne(`${base}/c/entries/defaults`).flush({ startingMagicItems: 0 });
    expect(receiver).toHaveBeenCalledWith({ startingMagicItems: 0 });
  });

  it('invalidates all related pending requests when the session is cleared', () => {
    inventory.getAllByCharacter('c').subscribe();
    adventures.getDefaults('c').subscribe();
    adventures.getAllByCharacter('c').subscribe();
    const requests = http.match(() => true);
    expect(requests.length).toBe(3);
    characters.clearCache();
    expect(requests.every(request => request.cancelled)).toBe(true);
  });
});
