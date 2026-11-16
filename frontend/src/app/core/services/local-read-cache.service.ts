import { DestroyRef, Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, Observable, catchError, defer, from, map, merge, shareReplay, switchMap, takeUntil, tap, throwError, throwIfEmpty, timeout, finalize } from 'rxjs';
import { LocalStore } from './local-store.service';
import { requestFetchedAt } from './request-cache';
import { ConnectionStatus } from './connection-status.service';

export interface ReadResult<T> {
  data: T;
  source: 'cloud' | 'copy';
  fetchedAt: number;
}

@Injectable({ providedIn: 'root' })
export class LocalReadCache {
  private readonly local = inject(LocalStore);
  private readonly pending = new Map<string, Observable<ReadResult<unknown>>>();

  constructor() {
    merge(this.local.sessionChanged, this.local.changes).subscribe(() => this.pending.clear());
  }

  read<T>(characterId: string, target: string, fetch: () => Observable<T>, refresh = false): Observable<ReadResult<T>> {
    const key = this.local.key(characterId, target);
    const offline = navigator.onLine === false;
    const requestKey = JSON.stringify([key, offline]);
    const owner = this.local.owner();
    const generation = this.local.currentGeneration();
    const current = () => owner === this.local.owner() && generation === this.local.currentGeneration();
    const active = this.pending.get(requestKey);
    if (active) return active as Observable<ReadResult<T>>;

    const fallback = (error: unknown) => owner
      ? from(this.local.getCopy<T>(characterId, target).catch(() => undefined)).pipe(
          switchMap(copy => !current() ? EMPTY : copy
            ? from([{ data: copy.data, source: 'copy' as const, fetchedAt: copy.savedAt }])
            : throwError(() => error)),
        )
      : throwError(() => error);

    const request = defer(() => {
      if (offline) return fallback({ status: 0 });
      const cloud = fetch();
      const cached = !refresh && requestFetchedAt(cloud) !== undefined;
      return cloud.pipe(
        timeout(10_000),
        throwIfEmpty(() => new Error('資料已變更，請重新取得。')),
        switchMap(data => current() ? from([data]) : throwError(() => new Error('資料已變更，請重新取得。'))),
        map(data => ({ data, source: 'cloud' as const, fetchedAt: requestFetchedAt(cloud) ?? Date.now() })),
        tap(result => {
          if (!cached && current()) {
            void this.local.putCopy(characterId, target, result.data, result.fetchedAt).catch(() => {});
          }
        }),
        catchError(error => {
          if ([401, 403, 404].includes(error.status)) {
            this.local.invalidate(characterId || undefined, owner, false);
            this.local.externalInvalidation.next();
          }
          const temporary = error.status === 0 || error.status >= 500 || error.name === 'TimeoutError';
          return temporary ? fallback(error) : throwError(() => error);
        }),
      );
    }).pipe(
      takeUntil(merge(this.local.sessionChanged, this.local.changes)),
      finalize(() => {
        if (this.pending.get(requestKey) === guarded) this.pending.delete(requestKey);
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
    );
    const guarded = defer(() => current() ? request : EMPTY);
    this.pending.set(requestKey, guarded as Observable<ReadResult<unknown>>);
    return guarded;
  }
}

/** Refresh only mounted reading pages; no polling or automatic writes. */
export function watchReadPage(
  refresh: (reason: 'online' | 'offline' | 'visible' | 'invalidated') => void,
  read: Parameters<ConnectionStatus['register']>[0],
): void {
  const destroy = inject(DestroyRef);
  const local = inject(LocalStore);
  inject(ConnectionStatus).register(read, destroy);
  const visible = () => {
    if (document.visibilityState === 'visible') refresh('visible');
  };
  const online = () => refresh('online');
  const offline = () => refresh('offline');
  window.addEventListener('online', online);
  window.addEventListener('offline', offline);
  document.addEventListener('visibilitychange', visible);
  local.changes.pipe(takeUntilDestroyed(destroy)).subscribe(() => refresh('invalidated'));
  destroy.onDestroy(() => {
    window.removeEventListener('online', online);
    window.removeEventListener('offline', offline);
    document.removeEventListener('visibilitychange', visible);
  });
}
