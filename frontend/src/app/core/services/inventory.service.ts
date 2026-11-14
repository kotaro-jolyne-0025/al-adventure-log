import { versionHeader, writeRequest } from './write-precondition';
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { RequestCache } from './request-cache';
import { environment } from '../../../environments/environment';
import { InventoryItem, InventoryItemRequest, InventoryMovement, InventoryMovementPage } from '../models/inventory.model';
import { CharacterService } from './character.service';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly http = inject(HttpClient);
  private readonly characterService = inject(CharacterService);
  private readonly base = `${environment.apiUrl}/characters`;

  // 記憶體快取
  private readonly inventoryCache = new RequestCache<InventoryItem[]>();
  private readonly historyCaches = new Map<string, RequestCache<InventoryMovementPage>>();

  constructor() {
    this.characterService.cacheInvalidated$.subscribe(id => this.clearCache(id));
  }

  clearCache(characterId?: string): void {
    this.inventoryCache.clear(characterId);
    if (characterId) {
      this.historyCaches.get(characterId)?.clear();
      this.historyCaches.delete(characterId);
    } else {
      this.historyCaches.forEach(cache => cache.clear());
      this.historyCaches.clear();
    }
  }

  movements(characterId: string, cursor?: string | null, refresh = false,
    scope?: { usageAdventureEntryId: string; reversed: boolean }): Observable<InventoryMovementPage> {
    let cache = this.historyCaches.get(characterId);
    if (!cache) { cache = new RequestCache(); this.historyCaches.set(characterId, cache); }
    const params: Record<string, string> = cursor ? { cursor } : {};
    if (scope) {
      params['usageAdventureEntryId'] = scope.usageAdventureEntryId;
      params['reversed'] = String(scope.reversed);
    }
    const key = JSON.stringify([scope?.usageAdventureEntryId ?? null, scope?.reversed ?? null, cursor ?? null]);
    return cache.get(key, () => this.http.get<InventoryMovementPage>(
      `${this.base}/${characterId}/inventory/movements`, { params }), refresh);
  }

  consume(characterId: string, item: InventoryItem, quantity: number, notes: string, usageAdventureEntryId: string | null): Observable<InventoryItem> {
    return this.http.post<InventoryItem>(`${this.base}/${characterId}/inventory/${item.id}/consume`,
      { quantity, notes, usageAdventureEntryId }, versionHeader(item.updatedAt)).pipe(
        tap(() => this.characterService.notifyCharacterChanged(characterId)));
  }

  updateUsage(characterId: string, movement: InventoryMovement, usageAdventureEntryId: string | null | undefined, notes?: string): Observable<InventoryMovement> {
    return this.http.patch<InventoryMovement>(`${this.base}/${characterId}/inventory/movements/${movement.id}/usage-adventure`,
      { ...(usageAdventureEntryId === undefined ? {} : { usageAdventureEntryId }), ...(notes === undefined ? {} : { notes }) }, versionHeader(movement.updatedAt)).pipe(
        tap(() => this.characterService.notifyCharacterChanged(characterId)));
  }

  reverse(characterId: string, movement: InventoryMovement): Observable<InventoryMovement> {
    return this.http.post<InventoryMovement>(`${this.base}/${characterId}/inventory/movements/${movement.id}/reverse`,
      {}, versionHeader(movement.updatedAt)).pipe(
        tap(() => this.characterService.notifyCharacterChanged(characterId)));
  }

  // 後端路徑：/api/characters/{id}/inventory

  getAllByCharacter(characterId: string, forceRefresh = false): Observable<InventoryItem[]> {
    return this.inventoryCache.get(characterId,
      () => this.http.get<InventoryItem[]>(`${this.base}/${characterId}/inventory`), forceRefresh);
  }

  create(characterId: string, req: InventoryItemRequest): Observable<InventoryItem> {
    const { body, options } = writeRequest(req);
    return this.http.post<InventoryItem>(
      `${this.base}/${characterId}/inventory`,
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
    itemId: string,
    req: InventoryItemRequest
  ): Observable<InventoryItem> {
    const { body, options } = writeRequest(req);
    return this.http.put<InventoryItem>(
      `${this.base}/${characterId}/inventory/${itemId}`,
      body, options
    ).pipe(
      tap(() => {
        this.clearCache(characterId);
        this.characterService.notifyCharacterChanged(characterId);
      })
    );
  }

  delete(characterId: string, itemId: string, expectedUpdatedAt?: string): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/${characterId}/inventory/${itemId}`,
      versionHeader(expectedUpdatedAt)
    ).pipe(
      tap(() => {
        this.clearCache(characterId);
        this.characterService.notifyCharacterChanged(characterId);
      })
    );
  }
}
