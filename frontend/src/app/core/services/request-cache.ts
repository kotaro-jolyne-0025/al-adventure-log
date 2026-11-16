import { AsyncSubject, defer, finalize, Observable, ReplaySubject, share, take, takeUntil, tap } from 'rxjs';

const fetchedTimes = new WeakMap<Observable<unknown>, number>();

export function requestFetchedAt(request: Observable<unknown>): number | undefined {
  return fetchedTimes.get(request);
}

/** A cache entry owns its request and replay buffer; invalidation retires all three. */
export class RequestCache<T> {
  private readonly entries = new Map<string, {
    cancel: ReplaySubject<void>;
    request: Observable<T>;
    expiresAt: number;
  }>();

  get(key: string, fetch: () => Observable<T>, forceRefresh = false): Observable<T> {
    const cached = this.entries.get(key);
    if (cached) {
      if (cached.expiresAt === Infinity || (!forceRefresh && performance.now() < cached.expiresAt)) {
        return cached.request;
      }
      this.clear(key);
    }

    const cancel = new ReplaySubject<void>(1);
    let completed = false;
    let fetchedAt: number | undefined;
    const request = defer(fetch).pipe(
      takeUntil(cancel),
      take(1),
      tap({
        next: () => {
          const entry = this.entries.get(key);
          if (entry?.cancel !== cancel) return;
          fetchedAt = Date.now();
          fetchedTimes.set(request, fetchedAt);
        },
        complete: () => {
          const entry = this.entries.get(key);
          if (fetchedAt === undefined || entry?.cancel !== cancel) return;
          completed = true;
          entry.expiresAt = performance.now() + 30_000;
        },
      }),
      finalize(() => {
        // An error or unsubscribed request must be retryable. Never remove its successor.
        if (!completed && this.entries.get(key)?.cancel === cancel) {
          this.entries.delete(key);
        }
      }),
      share({ connector: () => new AsyncSubject<T>(), resetOnComplete: false }),
      // Also block late subscribers to an already completed, now invalidated replay.
      takeUntil(cancel)
    );
    this.entries.set(key, { cancel, request, expiresAt: Infinity });
    return request;
  }

  clear(key?: string): void {
    const keys = key === undefined ? [...this.entries.keys()] : [key];
    for (const id of keys) {
      const entry = this.entries.get(id);
      this.entries.delete(id);
      if (entry) fetchedTimes.delete(entry.request);
      entry?.cancel.next();
      entry?.cancel.complete();
    }
  }
}
