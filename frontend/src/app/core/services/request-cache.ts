import { defer, finalize, Observable, ReplaySubject, shareReplay, takeUntil, tap } from 'rxjs';

/** A cache entry owns its request and replay buffer; invalidation retires all three. */
export class RequestCache<T> {
  private readonly entries = new Map<string, {
    cancel: ReplaySubject<void>;
    request: Observable<T>;
  }>();

  get(key: string, fetch: () => Observable<T>, forceRefresh = false): Observable<T> {
    if (forceRefresh) this.clear(key);
    const cached = this.entries.get(key);
    if (cached) return cached.request;

    const cancel = new ReplaySubject<void>(1);
    let completed = false;
    const request = defer(fetch).pipe(
      takeUntil(cancel),
      tap({ complete: () => completed = true }),
      finalize(() => {
        // An error or unsubscribed request must be retryable. Never remove its successor.
        if (!completed && this.entries.get(key)?.cancel === cancel) {
          this.entries.delete(key);
        }
      }),
      shareReplay({ bufferSize: 1, refCount: true }),
      // Also block late subscribers to an already completed, now invalidated replay.
      takeUntil(cancel)
    );
    this.entries.set(key, { cancel, request });
    return request;
  }

  clear(key?: string): void {
    const keys = key === undefined ? [...this.entries.keys()] : [key];
    for (const id of keys) {
      const entry = this.entries.get(id);
      this.entries.delete(id);
      entry?.cancel.next();
      entry?.cancel.complete();
    }
  }
}
