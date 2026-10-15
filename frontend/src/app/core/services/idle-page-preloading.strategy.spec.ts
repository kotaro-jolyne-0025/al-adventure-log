import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { IdlePagePreloadingStrategy } from './idle-page-preloading.strategy';

describe('IdlePagePreloadingStrategy', () => {
  const stable = new BehaviorSubject(false);
  const router = { url: '/characters/c/adventures' };
  let idle: IdleRequestCallback;
  beforeEach(() => {
    stable.next(false);
    router.url = '/characters/c/adventures';
    vi.stubGlobal('requestIdleCallback', vi.fn(callback => { idle = callback; return 1; }));
    vi.stubGlobal('cancelIdleCallback', vi.fn());
    TestBed.configureTestingModule({ providers: [
      { provide: ApplicationRef, useValue: { isStable: stable } },
      { provide: Router, useValue: router },
    ] });
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

  it('waits for a stable idle role page before loading code', () => {
    const load = vi.fn(() => of('code'));
    const strategy = TestBed.inject(IdlePagePreloadingStrategy);
    strategy.preload({ data: { preload: true } }, load).subscribe();
    expect(load).not.toHaveBeenCalled();
    stable.next(true);
    expect(load).not.toHaveBeenCalled();
    idle({} as IdleDeadline);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('does not preload unmarked routes or public pages', () => {
    const load = vi.fn(() => of('code'));
    const strategy = TestBed.inject(IdlePagePreloadingStrategy);
    strategy.preload({}, load).subscribe();
    router.url = '/login';
    strategy.preload({ data: { preload: true } }, load).subscribe();
    expect(requestIdleCallback).not.toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
  });

  it.each(['offline', 'saveData'])('rechecks connectivity at idle (%s)', mode => {
    const load = vi.fn(() => of('code'));
    const strategy = TestBed.inject(IdlePagePreloadingStrategy);
    stable.next(true);
    strategy.preload({ data: { preload: true } }, load).subscribe();
    if (mode === 'offline') vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    else vi.stubGlobal('navigator', { onLine: true, connection: { saveData: true } });
    idle({} as IdleDeadline);
    expect(load).not.toHaveBeenCalled();
  });

  it('falls back to a delay and absorbs preload errors', () => {
    vi.useFakeTimers();
    vi.stubGlobal('requestIdleCallback', undefined);
    stable.next(true);
    const load = vi.fn(() => throwError(() => new Error('network')));
    const error = vi.fn();
    TestBed.inject(IdlePagePreloadingStrategy).preload({ data: { preload: true } }, load).subscribe({ error });
    expect(load).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(load).toHaveBeenCalledTimes(1);
    expect(error).not.toHaveBeenCalled();
  });
});
