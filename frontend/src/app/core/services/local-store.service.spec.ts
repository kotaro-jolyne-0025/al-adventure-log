import { TestBed } from '@angular/core/testing';
import { LocalStore } from './local-store.service';

describe('Device storage failure and identity boundaries', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });
  it('reports denied storage and allows a later retry', async () => {
    const open = vi.fn(() => {
      throw new DOMException('denied', 'SecurityError');
    });
    vi.stubGlobal('indexedDB', { open });
    const local = TestBed.inject(LocalStore);
    local.setOwner('a');
    await expect(local.getDraft('c', 'new')).rejects.toThrow('denied');
    await expect(local.getDraft('c', 'new')).rejects.toThrow('denied');
    expect(open).toHaveBeenCalledTimes(2);
  });
  it('rejects opening work belonging to a retired session before it can touch a store', async () => {
    const request: Record<string, unknown> = {};
    const transaction = vi.fn();
    vi.stubGlobal('indexedDB', { open: () => request });
    const local = TestBed.inject(LocalStore);
    local.setOwner('a');
    const read = local.getDraft('c', 'new');
    local.setOwner('b');
    request['result'] = { transaction };
    (request['onsuccess'] as () => void)();
    await expect(read).rejects.toThrow('已變更');
    expect(transaction).not.toHaveBeenCalled();
  });
  it('scopes completion markers to both the account and exact draft revision', () => {
    const local = TestBed.inject(LocalStore);
    local.setOwner('a');
    local.markCloudSaved('c', 'new', 'saved', 2);
    expect(local.cloudSavedId('c', 'new', 2)).toBe('saved');
    expect(local.cloudSavedId('c', 'new', 3)).toBeNull();
    local.setOwner('b');
    expect(local.cloudSavedId('c', 'new', 2)).toBeNull();
    local.setOwner('a');
    expect(local.cloudSavedId('c', 'new', 2)).toBe('saved');
  });
});
