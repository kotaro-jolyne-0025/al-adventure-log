import { of, Subject, throwError } from 'rxjs';
import { RequestCache } from './request-cache';

describe('RequestCache', () => {
  it('shares a pending request and caches its successful result', () => {
    const cache = new RequestCache<number>();
    const source = new Subject<number>();
    const fetch = vi.fn(() => source.asObservable());
    const first = vi.fn(), second = vi.fn(), later = vi.fn();
    cache.get('key', fetch).subscribe(first);
    cache.get('key', fetch).subscribe(second);
    source.next(7); source.complete();
    cache.get('key', fetch).subscribe(later);
    expect(fetch).toHaveBeenCalledTimes(1);
    for (const receiver of [first, second, later]) expect(receiver).toHaveBeenCalledWith(7);
  });

  it('cancels an old session and blocks late responses and late subscriptions', () => {
    const cache = new RequestCache<string>();
    const oldSource = new Subject<string>();
    const oldRequest = cache.get('list', () => oldSource);
    const oldReceiver = vi.fn(), newReceiver = vi.fn(), lateReceiver = vi.fn();
    oldRequest.subscribe(oldReceiver);
    cache.clear();
    cache.get('list', () => of('B')).subscribe(newReceiver);
    oldSource.next('A'); oldSource.complete();
    oldRequest.subscribe(lateReceiver);
    expect(oldReceiver).not.toHaveBeenCalled();
    expect(lateReceiver).not.toHaveBeenCalled();
    expect(newReceiver).toHaveBeenCalledWith('B');
  });

  it('does not replay a completed old-session response after invalidation', () => {
    const cache = new RequestCache<string>();
    const request = cache.get('list', () => of('A'));
    request.subscribe();
    cache.clear();
    const receiver = vi.fn();
    request.subscribe(receiver);
    expect(receiver).not.toHaveBeenCalled();
  });

  it('force refresh replaces an in-flight request', () => {
    const cache = new RequestCache<number>();
    const old = new Subject<number>();
    const oldReceiver = vi.fn(), fresh = vi.fn();
    cache.get('key', () => old).subscribe(oldReceiver);
    cache.get('key', () => of(2), true).subscribe(fresh);
    old.next(1);
    expect(oldReceiver).not.toHaveBeenCalled();
    expect(fresh).toHaveBeenCalledWith(2);
  });

  it('retries after errors and after all subscribers leave a pending request', () => {
    const cache = new RequestCache<number>();
    cache.get('key', () => throwError(() => new Error('offline'))).subscribe({ error: () => {} });
    const pending = new Subject<number>();
    const subscription = cache.get('key', () => pending).subscribe();
    subscription.unsubscribe();
    const receiver = vi.fn();
    cache.get('key', () => of(3)).subscribe(receiver);
    expect(receiver).toHaveBeenCalledWith(3);
  });

  it('does not start a request obtained before invalidation but subscribed afterward', () => {
    const cache = new RequestCache<number>();
    const fetch = vi.fn(() => of(1));
    const request = cache.get('key', fetch);
    cache.clear();
    request.subscribe();
    expect(fetch).not.toHaveBeenCalled();
  });
});
