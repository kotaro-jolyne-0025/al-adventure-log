import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, Subject, throwError } from 'rxjs';
import { LocalStore } from './local-store.service';
import { LocalReadCache } from './local-read-cache.service';

describe('Reading-page fallback', () => {
  let local: LocalStore;
  let cache: LocalReadCache;
  beforeEach(() => {
    TestBed.configureTestingModule({});
    local = TestBed.inject(LocalStore);
    local.setOwner('a');
    vi.spyOn(local, 'putCopy').mockResolvedValue();
    vi.spyOn(local, 'getCopy').mockResolvedValue({
      key: 'k',
      ownerId: 'a',
      characterId: 'c',
      schemaVersion: 1,
      revision: 0,
      savedAt: 100,
      data: ['previous'],
    });
    vi.spyOn(local, 'invalidate').mockImplementation(() => {});
    cache = TestBed.inject(LocalReadCache);
  });
  it('uses a timestamped copy for temporary failure only', async () => {
    const result = await firstValueFrom(
      cache.read('c', 'items', () => throwError(() => ({ status: 503 }))),
    );
    expect(result).toEqual({ source: 'copy', fetchedAt: 100, data: ['previous'] });
    expect(local.putCopy).not.toHaveBeenCalled();
    expect(local.getCopy).toHaveBeenCalledTimes(1);
  });
  it.each([401, 403, 404, 400])('does not conceal status %s with a copy', async (status) => {
    vi.mocked(local.getCopy).mockResolvedValue(undefined);
    await expect(
      firstValueFrom(cache.read('c', 'items', () => throwError(() => ({ status })))),
    ).rejects.toMatchObject({ status });
    expect(local.getCopy).toHaveBeenCalledTimes(1);
    if ([403, 404].includes(status)) expect(local.invalidate).toHaveBeenCalled();
  });
  it('shows an available copy before cloud data, then replaces it with the complete response', async () => {
    const network = new Subject<string[]>();
    const values: string[][] = [];
    let completed = false;
    cache.read('c', 'items', () => network).subscribe({
      next: result => values.push(result.data),
      complete: () => { completed = true; },
    });
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(values).toEqual([['previous']]);
    expect(completed).toBe(false);
    network.next(['latest']);
    network.complete();
    expect(values).toEqual([['previous'], ['latest']]);
    expect(completed).toBe(true);
  });
  it('keeps the displayed copy when refresh fails temporarily', async () => {
    const values: string[][] = [];
    await new Promise<void>(resolve => cache.read('c', 'items', () => throwError(() => ({ status: 503 })))
      .subscribe({ next: result => values.push(result.data), complete: resolve }));
    expect(values).toEqual([['previous']]);
  });
  it('shows cloud success even if device storage fails', async () => {
    vi.mocked(local.getCopy).mockResolvedValue(undefined);
    vi.mocked(local.putCopy).mockRejectedValue(new Error('quota'));
    expect((await firstValueFrom(cache.read('c', 'items', () => of(['latest'])))).source).toBe(
      'cloud',
    );
  });
  it('merges in-progress reads and never replays a retired account request', async () => {
    vi.mocked(local.getCopy).mockResolvedValue(undefined);
    const network = new Subject<string[]>();
    const fetch = vi.fn(() => network);
    const first = cache.read('c', 'items', fetch);
    const second = cache.read('c', 'items', fetch);
    const a = firstValueFrom(first);
    const b = firstValueFrom(second);
    expect(fetch).toHaveBeenCalledTimes(1);
    local.setOwner('b');
    network.next(['a']);
    network.complete();
    await expect(a).rejects.toThrow();
    await expect(b).rejects.toThrow();
    expect(local.putCopy).not.toHaveBeenCalled();
  });
  it('does not replay an already completed copy after invalidation or account switching', async () => {
    vi.mocked(local.getCopy).mockResolvedValue(undefined);
    const old = cache.read('c', 'items', () => of(['a']));
    expect((await firstValueFrom(old)).data).toEqual(['a']);
    local.setOwner('b');
    await expect(firstValueFrom(old)).rejects.toThrow();
    expect(local.putCopy).toHaveBeenCalledTimes(1);
  });
  it('drops late cloud responses after silent invalidation before saving a copy', async () => {
    vi.mocked(local.getCopy).mockResolvedValue(undefined);
    vi.mocked(local.invalidate).mockRestore();
    const network = new Subject<string[]>();
    const result = firstValueFrom(cache.read('c', 'items', () => network));
    local.invalidate('c', 'a', false);
    network.next(['old']);
    network.complete();
    await expect(result).rejects.toThrow('資料已變更');
    expect(local.putCopy).not.toHaveBeenCalled();
  });
});
