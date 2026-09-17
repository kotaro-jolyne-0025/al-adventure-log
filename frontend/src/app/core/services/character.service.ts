import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { finalize, Observable, of, shareReplay, Subject, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Character, CharacterRequest } from '../models/character.model';

@Injectable({ providedIn: 'root' })
export class CharacterService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/characters`;

  private readonly _characterChanged$ = new Subject<string>();
  readonly characterChanged$ = this._characterChanged$.asObservable();

  // 記憶體快取
  private listCache: Character[] | null = null;
  private readonly itemCache = new Map<string, Character>();
  private listRequest$: Observable<Character[]> | null = null;
  private readonly itemRequests = new Map<string, Observable<Character>>();

  notifyCharacterChanged(characterId?: string): void {
    if (characterId) {
      this.itemCache.delete(characterId);
    }
    this.listCache = null;
    this._characterChanged$.next(characterId ?? '');
  }

  clearCache(): void {
    this.listCache = null;
    this.itemCache.clear();
  }

  getAll(forceRefresh = false): Observable<Character[]> {
    if (this.listCache && !forceRefresh) {
      return of(this.listCache);
    }
    if (this.listRequest$) {
      return this.listRequest$;
    }

    const request$ = this.http.get<Character[]>(this.base).pipe(
      tap((list) => {
        this.listCache = list;
        for (const item of list) {
          this.itemCache.set(item.id, item);
        }
      }),
      finalize(() => this.listRequest$ = null),
      shareReplay({ bufferSize: 1, refCount: true })
    );
    this.listRequest$ = request$;
    return request$;
  }

  getById(id: string, forceRefresh = false): Observable<Character> {
    const cached = this.itemCache.get(id);
    if (cached && !forceRefresh) {
      return of(cached);
    }
    const inFlight = this.itemRequests.get(id);
    if (inFlight) return inFlight;

    const request$ = this.http.get<Character>(`${this.base}/${id}`).pipe(
      tap((item) => this.itemCache.set(id, item)),
      finalize(() => this.itemRequests.delete(id)),
      shareReplay({ bufferSize: 1, refCount: true })
    );
    this.itemRequests.set(id, request$);
    return request$;
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

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${id}`).pipe(
      tap(() => this.notifyCharacterChanged(id))
    );
  }
}
