import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Character, CharacterRequest } from '../models/character.model';

@Injectable({ providedIn: 'root' })
export class CharacterService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/characters`;

  private readonly _characterChanged$ = new Subject<string>();
  readonly characterChanged$ = this._characterChanged$.asObservable();

  notifyCharacterChanged(characterId?: string): void {
    this._characterChanged$.next(characterId ?? '');
  }

  getAll(): Observable<Character[]> {
    return this.http.get<Character[]>(this.base);
  }

  getById(id: string): Observable<Character> {
    return this.http.get<Character>(`${this.base}/${id}`);
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
