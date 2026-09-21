import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CharacterService } from './character.service';
import { AdventureService } from './adventure.service';
import { InventoryService } from './inventory.service';
import { environment } from '../../../environments/environment';

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
