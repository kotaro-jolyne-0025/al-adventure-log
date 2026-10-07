import { ApplicationRef, computed, DestroyRef, inject, Injectable, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate } from '@angular/service-worker';
import { first, fromEvent } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly updates = inject(SwUpdate);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  readonly enabled = this.updates.isEnabled;
  readonly checking = signal(false);
  readonly updateReady = signal(false);
  readonly reloadRequired = signal(false);
  readonly needsReload = computed(() => this.updateReady() || this.reloadRequired());
  readonly message = signal(this.enabled ? '' : '此環境未啟用更新檢查。');

  constructor() {
    if (!this.enabled) return;

    this.updates.versionUpdates.pipe(takeUntilDestroyed()).subscribe(event => {
      if (event.type === 'VERSION_READY') {
        this.updateReady.set(true);
        this.message.set('');
      } else if (event.type === 'NO_NEW_VERSION_DETECTED') {
        this.message.set(this.needsReload() ? '' : '目前已是最新版本。');
      } else if (event.type === 'VERSION_INSTALLATION_FAILED') {
        this.message.set('新版下載失敗，請稍後再檢查更新。');
      }
    });
    this.updates.unrecoverable.pipe(takeUntilDestroyed()).subscribe(() => {
      this.reloadRequired.set(true);
    });

    inject(ApplicationRef).isStable.pipe(
      first(stable => stable), takeUntilDestroyed(),
    ).subscribe(() => {
      const checkWhenVisible = () => {
        if (this.document.visibilityState !== 'hidden') void this.checkForUpdates();
      };
      fromEvent(this.document, 'visibilitychange').pipe(
        takeUntilDestroyed(this.destroyRef),
      ).subscribe(checkWhenVisible);
      const view = this.document.defaultView;
      if (view) {
        fromEvent(view, 'online').pipe(takeUntilDestroyed(this.destroyRef))
          .subscribe(checkWhenVisible);
      }
      checkWhenVisible();
    });
  }

  async checkForUpdates(): Promise<void> {
    if (!this.enabled || this.checking()) return;
    if (this.document.defaultView?.navigator.onLine === false) {
      this.message.set('目前離線，連線後可再檢查更新。');
      return;
    }
    this.checking.set(true);
    this.message.set('正在檢查更新…');
    try {
      if (await this.updates.checkForUpdate()) {
        this.updateReady.set(true);
        this.message.set('');
      }
      if (this.message() === '正在檢查更新…') {
        this.message.set(this.needsReload() ? '' : '未能確認是否有新版，請稍後再試。');
      }
    } catch {
      this.message.set('無法完成更新檢查，請確認連線後再試。');
    } finally {
      this.checking.set(false);
    }
  }

  reload(): void {
    this.document.defaultView?.location.reload();
  }
}
