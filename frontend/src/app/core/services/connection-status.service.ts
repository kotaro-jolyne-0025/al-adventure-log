import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';

interface ConnectionRead {
  state: () => 'pending' | 'cloud' | 'copy' | 'failed' | 'draft' | 'inactive';
  retry: () => void;
}

@Injectable({ providedIn: 'root' })
export class ConnectionStatus {
  private readonly reads = signal<ConnectionRead[]>([]);
  private readonly offline = signal(navigator.onLine === false);
  private readonly recovering = signal(false);
  private readonly active = computed(() => this.reads().filter(read => read.state() !== 'inactive'));

  readonly status = computed(() => {
    const states = this.active().map(read => read.state());
    if (!states.length) return null;
    if (this.offline()) {
      if (states.includes('draft')) return 'offline-draft';
      return states.includes('copy') || states.includes('cloud') ? 'offline-copy' : 'offline-empty';
    }
    if (this.recovering() && states.includes('pending')) return null;
    if (states.includes('copy') || (this.recovering() && states.includes('failed'))) return 'failed';
    return null;
  });

  constructor() {
    const offline = () => {
      this.offline.set(true);
      this.recovering.set(false);
    };
    const online = () => {
      if (this.offline()) this.recovering.set(this.active().length > 0);
      this.offline.set(false);
    };
    window.addEventListener('offline', offline);
    window.addEventListener('online', online);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('offline', offline);
      window.removeEventListener('online', online);
    });
    effect(() => {
      if (this.recovering() && this.active().every(read => ['cloud', 'draft'].includes(read.state()))) {
        this.recovering.set(false);
      }
    });
  }

  register(read: ConnectionRead, destroy: DestroyRef): void {
    this.reads.update(reads => [...reads, read]);
    destroy.onDestroy(() => this.reads.update(reads => reads.filter(item => item !== read)));
  }

  retry(): void {
    if (this.offline() || this.status() !== 'failed') return;
    const failed = this.active().filter(read => ['copy', 'failed'].includes(read.state()));
    this.recovering.set(true);
    failed.forEach(read => read.retry());
  }
}
