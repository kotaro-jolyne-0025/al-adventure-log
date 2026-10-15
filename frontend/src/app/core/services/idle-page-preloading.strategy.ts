import { ApplicationRef, inject, Injectable } from '@angular/core';
import { PreloadingStrategy, Route, Router } from '@angular/router';
import { catchError, EMPTY, first, Observable, switchMap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class IdlePagePreloadingStrategy implements PreloadingStrategy {
  private readonly app = inject(ApplicationRef);
  private readonly router = inject(Router);

  preload(route: Route, load: () => Observable<unknown>): Observable<unknown> {
    if (!route.data?.['preload'] || !this.canPreload()) return EMPTY;
    return this.app.isStable.pipe(
      first(stable => stable),
      switchMap(() => new Observable<void>(subscriber => {
        const ready = () => { subscriber.next(); subscriber.complete(); };
        if (typeof window.requestIdleCallback === 'function') {
          const id = window.requestIdleCallback(ready);
          return () => window.cancelIdleCallback(id);
        }
        const id = window.setTimeout(ready, 1000);
        return () => window.clearTimeout(id);
      })),
      switchMap(() => this.canPreload() ? load() : EMPTY),
      catchError(() => EMPTY),
    );
  }

  private canPreload(): boolean {
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    return this.router.url.startsWith('/characters/') && navigator.onLine !== false && !connection?.saveData;
  }
}
