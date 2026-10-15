import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

export interface LocalRecord<T = unknown> {
  key: string;
  ownerId: string;
  characterId: string;
  schemaVersion: number;
  savedAt: number;
  revision: number;
  data: T;
}
export class DraftConflict extends Error {}

/** Device storage only. Never holds credentials or sends an API request. */
@Injectable({ providedIn: 'root' })
export class LocalStore {
  readonly owner = signal<string | null>(null);
  readonly changes = new Subject<string | undefined>();
  readonly sessionChanged = new Subject<void>();
  readonly freshCharacters = signal<ReadonlySet<string>>(new Set());
  private db?: Promise<IDBDatabase>;
  private generation = 0;
  private identityGeneration = 0;
  private readonly transactions = new Set<IDBTransaction>();
  private copiesBlocked = false;
  private readonly EPOCH_KEY = 'dnd_read_epochs';
  private persistentStorage?: Promise<boolean>;

  constructor() {
    window.addEventListener('storage', (event) => {
      if (event.key === this.EPOCH_KEY) {
        this.cancelWrites(true);
        this.freshCharacters.set(new Set());
        this.changes.next(undefined);
      }
    });
  }

  setOwner(owner: string | null): void {
    this.cancelWrites();
    this.owner.set(owner);
    this.freshCharacters.set(new Set());
    this.sessionChanged.next();
  }

  requestPersistentStorage(): Promise<boolean> {
    if (!this.persistentStorage) {
      try {
        this.persistentStorage = navigator.storage?.persist
          ? navigator.storage.persist().catch(() => false)
          : Promise.resolve(false);
      } catch {
        this.persistentStorage = Promise.resolve(false);
      }
    }
    return this.persistentStorage;
  }

  currentGeneration(): number {
    return this.generation;
  }

  private cancelWrites(copiesOnly = false): void {
    this.generation++;
    if (!copiesOnly) this.identityGeneration++;
    for (const tx of this.transactions) {
      if (copiesOnly && tx.objectStoreNames.contains('drafts')) continue;
      try {
        tx.abort();
      } catch {
        /* already committed */
      }
    }
  }

  markFresh(characterId: string, fresh: boolean): void {
    this.freshCharacters.update((current) => {
      const next = new Set(current);
      fresh ? next.add(characterId) : next.delete(characterId);
      return next;
    });
  }

  private epoch(characterId: string): string {
    try {
      const all = JSON.parse(localStorage.getItem(this.EPOCH_KEY) ?? '{}');
      return `${all[`${this.owner()}:*`] ?? ''}/${all[`${this.owner()}:${characterId || 'list'}`] ?? ''}`;
    } catch {
      this.copiesBlocked = true;
      return '';
    }
  }

  /** Synchronous tombstone precedes asynchronous deletion and HUD refresh. */
  invalidate(characterId?: string, owner = this.owner(), notify = true): void {
    this.cancelWrites(true);
    if (characterId) this.markFresh(characterId, false);
    else this.freshCharacters.set(new Set());
    if (owner) {
      try {
        const all = JSON.parse(localStorage.getItem(this.EPOCH_KEY) ?? '{}');
        all[`${owner}:${characterId ?? '*'}`] = crypto.randomUUID();
        if (characterId) all[`${owner}:list`] = crypto.randomUUID();
        localStorage.setItem(this.EPOCH_KEY, JSON.stringify(all));
      } catch {
        this.copiesBlocked = true;
      }
      void this.removeCopies(owner, characterId).catch(() => {
        /* tombstone still blocks copies */
      });
    }
    if (notify) this.changes.next(characterId);
  }

  private open(): Promise<IDBDatabase> {
    if (!this.db)
      this.db = new Promise<IDBDatabase>((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
          reject(new Error('無法使用本機儲存'));
          return;
        }
        const request = indexedDB.open('dnd-device-data', 1);
        request.onupgradeneeded = () => {
          for (const name of ['drafts', 'readCopies']) {
            const store = request.result.createObjectStore(name, { keyPath: 'key' });
            store.createIndex('ownerId', 'ownerId');
          }
        };
        request.onsuccess = () => {
          request.result.onversionchange = () => {
            request.result.close();
            this.db = undefined;
          };
          resolve(request.result);
        };
        request.onerror = () => reject(request.error);
        request.onblocked = () => reject(new Error('請關閉其他舊版頁面後重試'));
      }).catch((error) => {
        this.db = undefined;
        throw error;
      });
    return this.db;
  }

  key(characterId: string, target: string): string {
    return JSON.stringify([this.owner(), characterId, target]);
  }

  markCloudSaved(characterId: string, target: string, id: string, revision: number): void {
    try {
      localStorage.setItem(
        `dnd_draft_done:${this.key(characterId, target)}`,
        JSON.stringify({ id, revision }),
      );
    } catch {
      /* IndexedDB completion remains available */
    }
  }

  cloudSavedId(characterId: string, target: string, revision: number): string | null {
    try {
      const marker = JSON.parse(
        localStorage.getItem(`dnd_draft_done:${this.key(characterId, target)}`) ?? 'null',
      );
      return marker?.revision === revision && typeof marker.id === 'string' ? marker.id : null;
    } catch {
      return null;
    }
  }

  clearCloudSaved(characterId: string, target: string): void {
    try {
      localStorage.removeItem(`dnd_draft_done:${this.key(characterId, target)}`);
    } catch {
      /* Never clear a newer draft through this marker. */
    }
  }

  private async transact<T>(
    name: string,
    write: boolean,
    work: (store: IDBObjectStore, result: (value: T) => void, fail: (error: Error) => void) => void,
    enforceGeneration = true,
  ): Promise<T> {
    // Data refresh retires copies, but a current account's draft must finish
    // so cloud-save cleanup can delete its final revision safely.
    const currentGeneration = () => name === 'drafts' ? this.identityGeneration : this.generation;
    const generation = currentGeneration();
    const db = await this.open();
    if (enforceGeneration && generation !== currentGeneration()) throw new Error('帳號或資料已變更');
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(name, write ? 'readwrite' : 'readonly');
      if (write && enforceGeneration) this.transactions.add(tx);
      let value: T;
      let reason: Error | undefined;
      tx.oncomplete = () => {
        this.transactions.delete(tx);
        !enforceGeneration || generation === currentGeneration()
          ? resolve(value)
          : reject(new Error('帳號或資料已變更'));
      };
      tx.onabort = tx.onerror = () => {
        this.transactions.delete(tx);
        reject(reason ?? tx.error ?? new Error('本機儲存未完成'));
      };
      try {
        work(
          tx.objectStore(name),
          (item) => {
            value = item;
          },
          (error) => {
            reason = error;
            tx.abort();
          },
        );
      } catch (error) {
        reason = error as Error;
        tx.abort();
      }
    });
  }

  async getDraft<T>(characterId: string, target: string): Promise<LocalRecord<T> | undefined> {
    const key = this.key(characterId, target);
    return this.transact('drafts', false, (store, result) => {
      const request = store.get(key);
      request.onsuccess = () => result(request.result);
    });
  }

  async putDraft<T>(
    characterId: string,
    target: string,
    data: T,
    revision: number,
  ): Promise<LocalRecord<T>> {
    const ownerId = this.owner();
    if (!ownerId) throw new Error('請先登入');
    const key = this.key(characterId, target);
    return this.transact('drafts', true, (store, result, fail) => {
      const request = store.get(key);
      request.onsuccess = () => {
        try {
          if ((request.result?.revision ?? 0) !== revision) {
            fail(new DraftConflict('另一分頁已更新草稿'));
            return;
          }
          const record = {
            key,
            ownerId,
            characterId,
            schemaVersion: 1,
            savedAt: Date.now(),
            revision: revision + 1,
            data,
          };
          store.put(record);
          result(record);
        } catch (error) {
          fail(error as Error);
        }
      };
    });
  }

  deleteDraft(characterId: string, target: string, revision: number): Promise<void> {
    const key = this.key(characterId, target);
    return this.transact('drafts', true, (store, result, fail) => {
      const request = store.get(key);
      request.onsuccess = () => {
        try {
          if ((request.result?.revision ?? 0) !== revision) {
            fail(new DraftConflict('另一分頁已更新草稿'));
            return;
          }
          store.delete(key);
          result(undefined);
        } catch (error) {
          fail(error as Error);
        }
      };
    });
  }

  async getCopy<T>(characterId: string, target: string): Promise<LocalRecord<T> | undefined> {
    if (this.copiesBlocked || !this.owner()) return undefined;
    const key = this.key(characterId, target);
    const epoch = this.epoch(characterId);
    const record = await this.transact<LocalRecord<T> | undefined>(
      'readCopies',
      false,
      (store, result) => {
        const request = store.get(key);
        request.onsuccess = () => {
          const record = request.result;
          if (
            !record ||
            record.schemaVersion !== 1 ||
            record.epoch !== epoch ||
            !Number.isFinite(record.savedAt) ||
            record.data === undefined ||
            record.savedAt > Date.now() ||
            Date.now() - record.savedAt > 7 * 86400000
          ) {
            result(undefined);
            return;
          }
          result(record);
        };
      },
    );
    // Updating LRU metadata must not make a readable copy fail when storage is full.
    void this.transact('readCopies', true, (store, result, fail) => {
      const request = store.get(key);
      request.onsuccess = () => {
        try {
          if (request.result?.epoch === epoch) {
            if (record) store.put({ ...request.result, accessedAt: Date.now() });
            else store.delete(key);
          }
          result(undefined);
        } catch (error) {
          fail(error as Error);
        }
      };
    }).catch(() => {});
    return record;
  }

  async putCopy<T>(characterId: string, target: string, data: T, savedAt: number): Promise<void> {
    const ownerId = this.owner();
    if (!ownerId || this.copiesBlocked) return;
    const key = this.key(characterId, target);
    const epoch = this.epoch(characterId);
    return this.transact('readCopies', true, (store, result, fail) => {
      const request = store.index('ownerId').getAll(ownerId);
      request.onsuccess = () => {
        try {
          const others = (request.result as (LocalRecord & { accessedAt: number })[])
            .filter((item) => item.key !== key)
            .sort((a, b) => b.accessedAt - a.accessedAt);
          for (const item of others.slice(99)) store.delete(item.key);
          store.put({
            key,
            ownerId,
            characterId,
            schemaVersion: 1,
            revision: 0,
            data,
            savedAt,
            accessedAt: Date.now(),
            epoch,
          });
          result(undefined);
        } catch (error) {
          fail(error as Error);
        }
      };
    });
  }

  private removeCopies(ownerId: string, characterId?: string): Promise<void> {
    return this.transact(
      'readCopies',
      true,
      (store, result, fail) => {
        const request = store.index('ownerId').openCursor(ownerId);
        request.onsuccess = () => {
          try {
            const cursor = request.result;
            if (!cursor) {
              result(undefined);
              return;
            }
            // Lists depend on every character, so retire them with any mutation.
            if (
              !characterId ||
              cursor.value.characterId === characterId ||
              cursor.value.characterId === ''
            )
              cursor.delete();
            cursor.continue();
          } catch (error) {
            fail(error as Error);
          }
        };
      },
      false,
    );
  }
}
