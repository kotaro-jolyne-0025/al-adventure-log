import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AdventureEntry,
  AdventureEntryRequest,
  AdventureGainedItem,
  AdventureGainedItemRequest,
  DowntimeActivity,
  DowntimeActivityRequest,
  EntryDefaults,
} from '../models/adventure.model';
import { CharacterService } from './character.service';

@Injectable({ providedIn: 'root' })
export class AdventureService {
  private readonly http = inject(HttpClient);
  private readonly characterService = inject(CharacterService);
  private readonly base = `${environment.apiUrl}/characters`;

  // ── AdventureEntry ───────────────────────────────────────────────────────
  // 後端路徑：/api/characters/{id}/entries

  getAllByCharacter(characterId: string): Observable<AdventureEntry[]> {
    return this.http.get<AdventureEntry[]>(
      `${this.base}/${characterId}/entries`
    );
  }

  getDefaults(characterId: string): Observable<EntryDefaults> {
    return this.http.get<EntryDefaults>(
      `${this.base}/${characterId}/entries/defaults`
    );
  }

  getById(characterId: string, entryId: string): Observable<AdventureEntry> {
    return this.http.get<AdventureEntry>(
      `${environment.apiUrl}/entries/${entryId}`
    );
  }

  create(characterId: string, req: AdventureEntryRequest): Observable<AdventureEntry> {
    return this.http.post<AdventureEntry>(
      `${this.base}/${characterId}/entries`,
      req
    ).pipe(
      tap(() => this.characterService.notifyCharacterChanged(characterId))
    );
  }

  update(
    characterId: string,
    entryId: string,
    req: AdventureEntryRequest
  ): Observable<AdventureEntry> {
    return this.http.put<AdventureEntry>(
      `${environment.apiUrl}/entries/${entryId}`,
      req
    ).pipe(
      tap(() => this.characterService.notifyCharacterChanged(characterId))
    );
  }

  delete(characterId: string, entryId: string): Observable<void> {
    return this.http.delete<void>(
      `${environment.apiUrl}/entries/${entryId}`
    ).pipe(
      tap(() => this.characterService.notifyCharacterChanged(characterId))
    );
  }

  // ── DowntimeActivity ────────────────────────────────────────────────────
  // 後端路徑：/api/entries/{entryId}/downtime-activities

  addDowntime(entryId: string, req: DowntimeActivityRequest): Observable<DowntimeActivity> {
    return this.http.post<DowntimeActivity>(
      `${environment.apiUrl}/entries/${entryId}/downtime-activities`,
      req
    );
  }

  updateDowntime(downtimeId: string, req: DowntimeActivityRequest): Observable<DowntimeActivity> {
    return this.http.put<DowntimeActivity>(
      `${environment.apiUrl}/downtime-activities/${downtimeId}`,
      req
    );
  }

  deleteDowntime(entryId: string, downtimeId: string): Observable<void> {
    return this.http.delete<void>(
      `${environment.apiUrl}/downtime-activities/${downtimeId}`
    );
  }

  // ── AdventureGainedItem (冒險獲得物品快照) ───────────────────────────────────
  // 後端路徑：/api/entries/{entryId}/gained-items

  getGainedItems(entryId: string): Observable<AdventureGainedItem[]> {
    return this.http.get<AdventureGainedItem[]>(
      `${environment.apiUrl}/entries/${entryId}/gained-items`
    );
  }

  addGainedItem(entryId: string, req: AdventureGainedItemRequest): Observable<AdventureGainedItem> {
    return this.http.post<AdventureGainedItem>(
      `${environment.apiUrl}/entries/${entryId}/gained-items`,
      req
    );
  }

  updateGainedItem(entryId: string, itemId: string, req: AdventureGainedItemRequest): Observable<AdventureGainedItem> {
    return this.http.put<AdventureGainedItem>(
      `${environment.apiUrl}/entries/${entryId}/gained-items/${itemId}`,
      req
    );
  }

  deleteGainedItem(itemId: string): Observable<void> {
    return this.http.delete<void>(
      `${environment.apiUrl}/gained-items/${itemId}`
    );
  }
}
