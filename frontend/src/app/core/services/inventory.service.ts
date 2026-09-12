import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { InventoryItem, InventoryItemRequest } from '../models/inventory.model';
import { CharacterService } from './character.service';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly http = inject(HttpClient);
  private readonly characterService = inject(CharacterService);
  private readonly base = `${environment.apiUrl}/characters`;

  // 記憶體快取
  private readonly inventoryCache = new Map<string, InventoryItem[]>();

  clearCache(characterId?: string): void {
    if (characterId) {
      this.inventoryCache.delete(characterId);
    } else {
      this.inventoryCache.clear();
    }
  }

  // 後端路徑：/api/characters/{id}/inventory

  getAllByCharacter(characterId: string, forceRefresh = false): Observable<InventoryItem[]> {
    const cached = this.inventoryCache.get(characterId);
    const fetch$ = this.http.get<InventoryItem[]>(
      `${this.base}/${characterId}/inventory`
    ).pipe(
      tap((items) => this.inventoryCache.set(characterId, items))
    );

    if (cached && !forceRefresh) {
      return new Observable<InventoryItem[]>((subscriber) => {
        subscriber.next(cached);
        fetch$.subscribe({
          next: (fresh) => {
            subscriber.next(fresh);
            subscriber.complete();
          },
          error: () => subscriber.complete(),
        });
      });
    }

    return fetch$;
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

