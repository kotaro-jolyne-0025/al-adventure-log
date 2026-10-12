import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  catchError,
  defer,
  finalize,
  from,
  map,
  merge,
  shareReplay,
  switchMap,
  takeUntil,
  tap,
  throwError,
  timeout,
} from 'rxjs';
import { LocalStore } from './local-store.service';

export interface ReadResult<T> {
  data: T;
  source: 'cloud' | 'copy';
  fetchedAt: number;
}

/** Only reading pages use fallback. Form/API services stay cloud-only. */
@Injectable({ providedIn: 'root' })
export class LocalReadCache {
  private readonly local = inject(LocalStore);
  private readonly pending = new Map<string, Observable<ReadResult<unknown>>>();

  constructor() {
    merge(this.local.sessionChanged, this.local.changes).subscribe(() => this.pending.clear());
  }

  read<T>(
    characterId: string,
    target: string,
    fetch: () => Observable<T>,
  ): Observable<ReadResult<T>> {
    const key = this.local.key(characterId, target);
    const current = this.pending.get(key);
    if (current) return current as Observable<ReadResult<T>>;
    const owner = this.local.owner();
    const generation = this.local.currentGeneration();
    const currentResult = (result: ReadResult<T>) => {
      if (owner !== this.local.owner()) return EMPTY;
      if (generation !== this.local.currentGeneration())
        return throwError(() => new Error('資料已變更，請重新取得。'));
      return from([result]);
    };
    let request!: Observable<ReadResult<T>>;
    const shared = defer(fetch).pipe(
      timeout(10000),
      map((data) => ({ data, source: 'cloud' as const, fetchedAt: Date.now() })),
      switchMap(currentResult),
      tap((result) => {
        void this.local.putCopy(characterId, target, result.data, result.fetchedAt).catch(() => {});
      }),
      catchError((error) => {
        if ([403, 404].includes(error.status)) this.local.invalidate(characterId, owner, false);
        if (!(error.status === 0 || error.status >= 500 || error.name === 'TimeoutError'))
          return throwError(() => error);
        if (!owner) return throwError(() => error);
        return from(this.local.getCopy<T>(characterId, target).catch(() => undefined)).pipe(
          switchMap((copy) =>
            copy
              ? from([{ data: copy.data, source: 'copy' as const, fetchedAt: copy.savedAt }])
              : throwError(() => error),
          ),
        );
      }),
      switchMap(currentResult),
      takeUntil(merge(this.local.sessionChanged, this.local.changes)),
      finalize(() => {
        if (this.pending.get(key) === request) this.pending.delete(key);
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    request = defer(() =>
      owner === this.local.owner() && generation === this.local.currentGeneration()
        ? shared
        : EMPTY,
    );
    this.pending.set(key, request as Observable<ReadResult<unknown>>);
    return request;
  }
}

/** Refresh only mounted reading pages; no polling or automatic writes. */
export function watchReadPage(refresh: () => void): void {
  const destroy = inject(DestroyRef);
  const local = inject(LocalStore);
  const visible = () => {
    if (document.visibilityState === 'visible') refresh();
  };
  window.addEventListener('online', refresh);
  window.addEventListener('offline', refresh);
  document.addEventListener('visibilitychange', visible);
  local.changes.pipe(takeUntilDestroyed(destroy)).subscribe(refresh);
  destroy.onDestroy(() => {
    window.removeEventListener('online', refresh);
    window.removeEventListener('offline', refresh);
    document.removeEventListener('visibilitychange', visible);
  });
}
