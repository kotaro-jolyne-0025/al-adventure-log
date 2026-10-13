import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class DraftUpdateCoordinator {
  private prepare?: () => Promise<boolean>;

  register(prepare: () => Promise<boolean>): () => void {
    this.prepare = prepare;
    return () => {
      if (this.prepare === prepare) this.prepare = undefined;
    };
  }

  prepareReload(): Promise<boolean> {
    return this.prepare?.() ?? Promise.resolve(true);
  }
}
