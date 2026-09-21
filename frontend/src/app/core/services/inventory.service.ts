import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { RequestCache } from './request-cache';
import { environment } from '../../../environments/environment';
import { InventoryItem, InventoryItemRequest } from '../models/inventory.model';
import { CharacterService } from './character.service';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly http = inject(HttpClient);
  private readonly characterService = inject(CharacterService);
  private readonly base = `${environment.apiUrl}/characters`;

  // 記憶體快取
  private readonly inventoryCache = new RequestCache<InventoryItem[]>();

  constructor() {
    this.characterService.cacheInvalidated$.subscribe(id => this.clearCache(id));
  }

  clearCache(characterId?: string): void {
    this.inventoryCache.clear(characterId);
  }

  // 後端路徑：/api/characters/{id}/inventory

  getAllByCharacter(characterId: string, forceRefresh = false): Observable<InventoryItem[]> {
    return this.inventoryCache.get(characterId,
      () => this.http.get<InventoryItem[]>(`${this.base}/${characterId}/inventory`), forceRefresh);
  }

  create(characterId: string, req: InventoryItemRequest): Observable<InventoryItem> {
    return this.http.post<InventoryItem>(
      `${this.base}/${characterId}/inventory`,
      req
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
    return this.http.put<InventoryItem>(
      `${this.base}/${characterId}/inventory/${itemId}`,
      req
    ).pipe(
      tap(() => {
        this.clearCache(characterId);
        this.characterService.notifyCharacterChanged(characterId);
      })
    );
  }

  delete(characterId: string, itemId: string): Observable<void> {
    return this.http.delete<void>(
      `${this.base}/${characterId}/inventory/${itemId}`
    ).pipe(
      tap(() => {
        this.clearCache(characterId);
        this.characterService.notifyCharacterChanged(characterId);
      })
    );
  }
}
