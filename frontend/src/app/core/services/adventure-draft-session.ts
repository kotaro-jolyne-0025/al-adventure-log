import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AdventureDraft, AdventureDraftInput, isDraftInput } from '../models/adventure-draft';
import { DraftConflict, LocalRecord, LocalStore } from './local-store.service';
import { Subject } from 'rxjs';

/** One mounted form owns the debounce and serial writes for its draft. */
@Injectable()
export class AdventureDraftSession {
  private readonly local = inject(LocalStore);
  private readonly destroy = inject(DestroyRef);
  readonly record = signal<LocalRecord<AdventureDraft> | undefined>(undefined);
  readonly status = signal('');
  readonly error = signal<string | null>(null);
  readonly offered = signal(false);
  readonly compatible = signal(true);
  readonly cloudReady = signal(false);
  readonly retired = new Subject<void>();
  private owner: string | null = null;
  private characterId = '';
  private target = '';
  private baseline: string | null = null;
  private initial = '';
  private lastSaved = '';
  private latest?: AdventureDraftInput;
  private readonly loaded = signal(false);
  private stopped = false;
  private sessionRetired = false;
  private revision = 0;
  private timer?: ReturnType<typeof setTimeout>;
  private writes: Promise<void> = Promise.resolve();

  constructor() {
    this.local.sessionChanged.pipe(takeUntilDestroyed(this.destroy)).subscribe(() => {
      this.sessionRetired = true;
      this.stopped = true;
      clearTimeout(this.timer);
      this.record.set(undefined);
      this.offered.set(false);
      this.retired.next();
    });
  }

  async start(characterId: string, target: string): Promise<void> {
    this.characterId = characterId;
    this.target = target;
    this.owner = this.local.owner();
    if (!this.owner) {
      this.loaded.set(true);
      return;
    }
    try {
      const record = await this.local.getDraft<AdventureDraft>(characterId, target);
      if (this.stopped || this.owner !== this.local.owner()) return;
      const completedId = this.local.cloudSavedId(characterId, target, record?.revision ?? 0);
      if (record && completedId && record.data) record.data.cloudSavedId = completedId;
      if (!record) this.local.clearCloudSaved(characterId, target);
      this.record.set(record);
      this.revision = record?.revision ?? 0;
      this.compatible.set(
        !record || (record.schemaVersion === 1 && isDraftInput(record.data?.input)),
      );
      this.offered.set(!!record);
      if (record?.data?.cloudSavedId)
        this.status.set('此草稿已儲存至雲端，請先查看紀錄，再捨棄本機草稿。');
    } catch {
      this.error.set('無法讀取本機草稿。目前輸入仍可儲存至雲端。');
    } finally {
      this.loaded.set(true);
    }
  }

  cloudLoaded(baseline: string | null, initial: AdventureDraftInput): void {
    this.baseline = baseline;
    this.initial = JSON.stringify(initial);
    this.lastSaved = this.initial;
    this.latest = initial;
    this.cloudReady.set(true);
  }

  canRestore(): boolean {
    const record = this.record();
    return (
      this.cloudReady() &&
      this.compatible() &&
      !!record &&
      !record.data.cloudSavedId &&
      record.data.baseline === this.baseline
    );
  }

  accept(): AdventureDraftInput | undefined {
    if (!this.canRestore()) return undefined;
    const input = this.record()!.data.input;
    this.lastSaved = JSON.stringify(input);
    this.latest = input;
    this.offered.set(false);
    this.status.set('草稿已恢復，尚未儲存至雲端。');
    return structuredClone(input);
  }

  capture(input: AdventureDraftInput): void {
    if (this.stopped || !this.loaded() || !this.cloudReady() || this.offered() || !this.owner)
      return;
    this.latest = input;
    clearTimeout(this.timer);
    if (JSON.stringify(input) === this.lastSaved) return;
    this.status.set('正在保存本機草稿…');
    this.timer = setTimeout(() => {
      void this.flush();
    }, 1000);
  }

  flush(): Promise<void> {
    clearTimeout(this.timer);
    const input = this.latest;
    if (!input || this.stopped || this.offered() || !this.cloudReady() || !this.owner)
      return this.writes;
    const serial = JSON.stringify(input);
    this.writes = this.writes.then(async () => {
      if (this.stopped || serial === this.lastSaved || this.owner !== this.local.owner()) return;
      try {
        const record = await this.local.putDraft(
          this.characterId,
          this.target,
          { input, baseline: this.baseline },
          this.revision,
        );
        if (this.stopped || !this.isCurrentOwner()) return;
        this.revision = record.revision;
        this.record.set(record);
        this.lastSaved = serial;
        this.error.set(null);
        this.status.set('草稿已保存在此裝置，尚未儲存至雲端。');
      } catch (error) {
        if (this.stopped) return;
        if (error instanceof DraftConflict) this.stopped = true;
        this.error.set(
          error instanceof DraftConflict
            ? '另一分頁已更新草稿，本頁輸入未覆寫它。請取回文字或重新載入。'
            : '本機草稿未保存，請重試或取回文字；仍可線上儲存至雲端。',
        );
      }
    });
    return this.writes;
  }

  async discard(): Promise<void> {
    clearTimeout(this.timer);
    await this.writes;
    if (!this.isCurrentOwner()) return;
    try {
      await this.local.deleteDraft(this.characterId, this.target, this.revision);
      this.local.clearCloudSaved(this.characterId, this.target);
      this.record.set(undefined);
      this.revision = 0;
      this.offered.set(false);
      this.lastSaved = this.latest ? JSON.stringify(this.latest) : this.initial;
      this.error.set(null);
      this.status.set('本機草稿已捨棄。');
    } catch {
      this.error.set('草稿未能清除，可能已被另一分頁更新。請重試或重新載入。');
    }
  }

  async savedToCloud(id: string): Promise<boolean> {
    this.stopped = true;
    clearTimeout(this.timer);
    if (!this.owner) return true;
    if (!this.isCurrentOwner()) return false;
    this.local.markCloudSaved(this.characterId, this.target, id, this.revision);
    await this.writes;
    if (!this.isCurrentOwner()) return false;
    try {
      // Persist completion before deletion, so a failed delete cannot offer resubmission.
      if (this.record()) {
        const done = await this.local.putDraft(
          this.characterId,
          this.target,
          { ...this.record()!.data, cloudSavedId: id },
          this.revision,
        );
        if (!this.isCurrentOwner()) return false;
        this.revision = done.revision;
      }
      await this.local.deleteDraft(this.characterId, this.target, this.revision);
      this.local.clearCloudSaved(this.characterId, this.target);
      this.record.set(undefined);
      return true;
    } catch {
      this.error.set('雲端已儲存，本機草稿尚未清除。請先查看雲端紀錄。');
      return false;
    }
  }

  baselineMatches(value: string): boolean {
    return this.baseline === value;
  }
  isReady(): boolean {
    return this.loaded();
  }
  isCurrentOwner(): boolean {
    return !this.sessionRetired && this.owner === this.local.owner();
  }
  pause(): void {
    clearTimeout(this.timer);
  }
}
