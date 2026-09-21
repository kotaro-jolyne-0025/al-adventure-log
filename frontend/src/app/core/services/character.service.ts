import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, tap } from 'rxjs';
import { RequestCache } from './request-cache';
import { environment } from '../../../environments/environment';
import { Character, CharacterRequest, CharacterBaselineRequest, CharacterBaselinePreview } from '../models/character.model';

@Injectable({ providedIn: 'root' })
export class CharacterService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/characters`;

  private readonly _characterChanged$ = new Subject<string>();
  readonly characterChanged$ = this._characterChanged$.asObservable();

  private readonly _cacheInvalidated$ = new Subject<string | undefined>();
  readonly cacheInvalidated$ = this._cacheInvalidated$.asObservable();
  private readonly listCache = new RequestCache<Character[]>();
  private readonly itemCache = new RequestCache<Character>();

  notifyCharacterChanged(characterId?: string): void {
    this.itemCache.clear(characterId);
    this.listCache.clear();
    // Invalidate every related cache before HUD subscribers start new requests.
    this._cacheInvalidated$.next(characterId);
    this._characterChanged$.next(characterId ?? '');
  }

  clearCache(): void {
    this.listCache.clear();
    this.itemCache.clear();
    this._cacheInvalidated$.next(undefined);
  }

  getAll(forceRefresh = false): Observable<Character[]> {
    return this.listCache.get('all', () => this.http.get<Character[]>(this.base), forceRefresh);
  }

  getById(id: string, forceRefresh = false): Observable<Character> {
    return this.itemCache.get(id, () => this.http.get<Character>(`${this.base}/${id}`), forceRefresh);
  }

  create(req: CharacterRequest): Observable<Character> {
    return this.http.post<Character>(this.base, req).pipe(
      tap((created) => this.notifyCharacterChanged(created.id))
    );
  }

  update(id: string, req: CharacterRequest): Observable<Character> {
    return this.http.put<Character>(`${this.base}/${id}`, req).pipe(
      tap(() => this.notifyCharacterChanged(id))
    );
  }

  previewOpeningBaseline(id: string, req: CharacterBaselineRequest): Observable<CharacterBaselinePreview> {
    return this.http.post<CharacterBaselinePreview>(`${this.base}/${id}/opening-baseline-preview`, req);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`).pipe(
      tap(() => this.notifyCharacterChanged(id))
    );
  }
}
