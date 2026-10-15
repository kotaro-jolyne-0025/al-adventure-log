import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  EMPTY,
  Observable,
  defer,
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
    const shared = new Observable<ReadResult<T>>((subscriber) => {
      let copyRecord: Awaited<ReturnType<typeof this.local.getCopy<T>>> | undefined;
      let networkSettled = false;
      let networkHasValue = false;
      let copyEmitted = false;
      const emitCopy = () => {
        if (!copyRecord || copyEmitted || subscriber.closed) return;
        if (owner !== this.local.owner()) return;
        if (generation !== this.local.currentGeneration()) {
          subscriber.error(new Error('資料已變更，請重新取得。'));
          return;
        }
        copyEmitted = true;
        subscriber.next({ data: copyRecord.data, source: 'copy', fetchedAt: copyRecord.savedAt });
      };
      const copyRead = this.local.getCopy<T>(characterId, target).catch(() => undefined).then((record) => {
        copyRecord = record;
        if (!networkHasValue) emitCopy();
      });
      const networkSubscription = defer(fetch).pipe(
      timeout(10000),
      map((data) => ({ data, source: 'cloud' as const, fetchedAt: Date.now() })),
      switchMap(currentResult),
      tap((result) => {
        void this.local.putCopy(characterId, target, result.data, result.fetchedAt).catch(() => {});
      }),
      takeUntil(merge(this.local.sessionChanged, this.local.changes)),
      ).subscribe({
        next: (result) => {
          networkHasValue = true;
          emitCopy();
          subscriber.next(result);
        },
        error: (error) => {
          networkSettled = true;
        if ([403, 404].includes(error.status)) this.local.invalidate(characterId, owner, false);
          const temporary = error.status === 0 || error.status >= 500 || error.name === 'TimeoutError';
          if (!temporary || !owner) subscriber.error(error);
          else void copyRead.then(() => {
            if (subscriber.closed) return;
            if (copyRecord) { emitCopy(); subscriber.complete(); }
            else subscriber.error(error);
          });
        },
        complete: () => {
          networkSettled = true;
          if (!networkHasValue) void copyRead.then(() => {
            if (subscriber.closed) return;
            if (!copyEmitted) emitCopy();
            subscriber.complete();
          });
          else subscriber.complete();
        },
      });
      return () => {
        networkSubscription.unsubscribe();
        if (this.pending.get(key) === request) this.pending.delete(key);
      };
    }).pipe(shareReplay({ bufferSize: 1, refCount: true }));
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
