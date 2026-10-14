import { versionHeader, writeRequest } from './write-precondition';
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable, tap } from 'rxjs';
import { RequestCache } from './request-cache';
import { environment } from '../../../environments/environment';
import {
  AdventureEntry,
  AdventureEntryRequest,
  AdventureEntrySaveRequest,
  AdventureGainedItem,
  AdventureGainedItemRequest,
  DowntimeActivity,
  DowntimeActivityRequest,
  EntryDefaults,
  StoryAward,
  StoryAwardRequest,
} from '../models/adventure.model';
import { CharacterService } from './character.service';

@Injectable({ providedIn: 'root' })
export class AdventureService {
  private readonly http = inject(HttpClient);
  private readonly characterService = inject(CharacterService);
  private readonly base = `${environment.apiUrl}/characters`;

  // 記憶體快取
  private readonly entriesCache = new RequestCache<AdventureEntry[]>();
  private readonly defaultsCache = new RequestCache<EntryDefaults>();

  constructor() {
    this.characterService.cacheInvalidated$.subscribe(id => this.clearCache(id));
  }

  clearCache(characterId?: string): void {
    this.entriesCache.clear(characterId);
    this.defaultsCache.clear(characterId);
  }

  // ── AdventureEntry ───────────────────────────────────────────────────────
  // 後端路徑：/api/characters/{id}/entries

  getAllByCharacter(characterId: string, forceRefresh = false): Observable<AdventureEntry[]> {
    return this.entriesCache.get(characterId,
      () => this.http.get<AdventureEntry[]>(`${this.base}/${characterId}/entries`), forceRefresh);
  }

  getDefaults(characterId: string, forceRefresh = false): Observable<EntryDefaults> {
    return this.defaultsCache.get(characterId,
      () => this.http.get<EntryDefaults>(`${this.base}/${characterId}/entries/defaults`), forceRefresh);
  }

  getById(characterId: string, entryId: string): Observable<AdventureEntry> {
    return this.http.get<AdventureEntry>(
      `${environment.apiUrl}/entries/${entryId}`
    );
  }

  getDetails(characterId: string, entryId: string) {
    return this.getById(characterId, entryId).pipe(map(response => {
      if (response.characterId !== characterId || !Array.isArray(response.storyAwards) || !Array.isArray(response.gainedItems)
          || typeof response.updatedAt !== 'string' || !response.updatedAt) {
        throw new Error('冒險資料或更新時間不完整，請更新網頁後重新載入。');
      }
      const storyAwards = response.storyAwards;
      const { gainedItems, legacyItems, ...entry } = response;
      if (gainedItems.length === 0 && !Array.isArray(legacyItems)) {
        throw new Error('舊倉庫資料未完整載入。');
      }
      return { entry, gainedItems, storyAwards, legacyItems: legacyItems ?? [] };
    }));
  }

  create(characterId: string, req: AdventureEntryRequest): Observable<AdventureEntry> {
    const { body, options } = writeRequest(req);
    return this.http.post<AdventureEntry>(
      `${this.base}/${characterId}/entries`,
      body, options
    ).pipe(
      tap(() => {
        this.clearCache(characterId);
        this.characterService.notifyCharacterChanged(characterId);
      })
    );
  }

  createWithDetails(characterId: string, req: AdventureEntrySaveRequest): Observable<AdventureEntry> {
    const { body, options } = writeRequest(req);
    return this.http.post<AdventureEntry>(
      `${this.base}/${characterId}/entries/with-details`,
      body, options
    ).pipe(
      tap(() => {
        this.clearCache(characterId);
        this.characterService.notifyCharacterChanged(characterId);
      })
    );
  }

  update(
    characterId: string,
    entryId: string,
    req: AdventureEntryRequest
  ): Observable<AdventureEntry> {
    const { body, options } = writeRequest(req);
    return this.http.put<AdventureEntry>(
      `${environment.apiUrl}/entries/${entryId}`,
      body, options
    ).pipe(
      tap(() => {
        this.clearCache(characterId);
        this.characterService.notifyCharacterChanged(characterId);
      })
    );
  }

  updateWithDetails(
    characterId: string,
    entryId: string,
    req: AdventureEntrySaveRequest
  ): Observable<AdventureEntry> {
    const { body, options } = writeRequest(req);
    return this.http.put<AdventureEntry>(
      `${environment.apiUrl}/entries/${entryId}/with-details`,
      body, options
    ).pipe(
      tap(() => {
        this.clearCache(characterId);
        this.characterService.notifyCharacterChanged(characterId);
      })
    );
  }

  delete(characterId: string, entryId: string, expectedUpdatedAt?: string): Observable<void> {
    return this.http.delete<void>(
      `${environment.apiUrl}/entries/${entryId}`,
      versionHeader(expectedUpdatedAt)
    ).pipe(
      tap(() => {
        this.clearCache(characterId);
        this.characterService.notifyCharacterChanged(characterId);
      })
    );
  }

  // ── DowntimeActivity ────────────────────────────────────────────────────
  // 後端路徑：/api/entries/{entryId}/downtime-activities

  addDowntime(entryId: string, req: DowntimeActivityRequest): Observable<DowntimeActivity> {
    const { body, options } = writeRequest(req);
    return this.http.post<DowntimeActivity>(
      `${environment.apiUrl}/entries/${entryId}/downtime-activities`,
      body, options
    );
  }

  updateDowntime(downtimeId: string, req: DowntimeActivityRequest): Observable<DowntimeActivity> {
    const { body, options } = writeRequest(req);
    return this.http.put<DowntimeActivity>(
      `${environment.apiUrl}/downtime-activities/${downtimeId}`,
      body, options
    );
  }

  deleteDowntime(entryId: string, downtimeId: string, expectedUpdatedAt?: string): Observable<void> {
    return this.http.delete<void>(
      `${environment.apiUrl}/downtime-activities/${downtimeId}`,
      versionHeader(expectedUpdatedAt)
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
    const { body, options } = writeRequest(req);
    return this.http.post<AdventureGainedItem>(
      `${environment.apiUrl}/entries/${entryId}/gained-items`,
      body, options
    );
  }

  updateGainedItem(entryId: string, itemId: string, req: AdventureGainedItemRequest): Observable<AdventureGainedItem> {
    const { body, options } = writeRequest(req);
    return this.http.put<AdventureGainedItem>(
      `${environment.apiUrl}/entries/${entryId}/gained-items/${itemId}`,
      body, options
    );
  }

  deleteGainedItem(itemId: string, expectedUpdatedAt?: string): Observable<void> {
    return this.http.delete<void>(
      `${environment.apiUrl}/gained-items/${itemId}`,
      versionHeader(expectedUpdatedAt)
    );
  }

  // ── StoryAward (故事獎勵) ───────────────────────────────────────────────────
  // 後端路徑：/api/entries/{entryId}/story-awards

  getStoryAwards(entryId: string): Observable<StoryAward[]> {
    return this.http.get<StoryAward[]>(
      `${environment.apiUrl}/entries/${entryId}/story-awards`
    );
  }

  addStoryAward(entryId: string, req: StoryAwardRequest): Observable<StoryAward> {
    const { body, options } = writeRequest(req);
    return this.http.post<StoryAward>(
      `${environment.apiUrl}/entries/${entryId}/story-awards`,
      body, options
    );
  }

  updateStoryAward(entryId: string, awardId: string, req: StoryAwardRequest): Observable<StoryAward> {
    const { body, options } = writeRequest(req);
    return this.http.put<StoryAward>(
      `${environment.apiUrl}/entries/${entryId}/story-awards/${awardId}`,
      body, options
    );
  }

  deleteStoryAward(awardId: string, expectedUpdatedAt?: string): Observable<void> {
    return this.http.delete<void>(
      `${environment.apiUrl}/story-awards/${awardId}`,
      versionHeader(expectedUpdatedAt)
    );
  }
}
