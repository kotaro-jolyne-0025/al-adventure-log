import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { AppUpdateService } from './app-update.service';

describe('AppUpdateService', () => {
  let stable: Subject<boolean>;
  let versions: Subject<VersionEvent>;
  let unrecoverable: Subject<{ reason: string }>;
  let check: ReturnType<typeof vi.fn>;
  let service: AppUpdateService;
  const ready: VersionEvent = {
    type: 'VERSION_READY', currentVersion: { hash: 'old' }, latestVersion: { hash: 'new' },
  };

  beforeEach(() => {
    stable = new Subject();
    versions = new Subject();
    unrecoverable = new Subject();
    check = vi.fn().mockImplementation(async () => {
      versions.next({ type: 'NO_NEW_VERSION_DETECTED', version: { hash: 'old' } });
      return false;
    });
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    TestBed.configureTestingModule({ providers: [
      { provide: ApplicationRef, useValue: { isStable: stable } },
      { provide: SwUpdate, useValue: {
        isEnabled: true, versionUpdates: versions, unrecoverable, checkForUpdate: check,
      } },
    ] });
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('checks once after stabilization and when returning visible or online', async () => {
    service = TestBed.inject(AppUpdateService);
    stable.next(false);
    window.dispatchEvent(new Event('online'));
    expect(check).not.toHaveBeenCalled();
    stable.next(true);
    await Promise.resolve();
    expect(check).toHaveBeenCalledTimes(1);
    stable.next(true);
    document.dispatchEvent(new Event('visibilitychange'));
    await Promise.resolve();
    window.dispatchEvent(new Event('online'));
    await Promise.resolve();
    expect(check).toHaveBeenCalledTimes(3);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('online'));
    expect(check).toHaveBeenCalledTimes(3);
  });

  it('merges concurrent checks and reports the completed result', async () => {
    service = TestBed.inject(AppUpdateService);
    let finish!: (found: boolean) => void;
    check.mockImplementation(() => new Promise<boolean>(resolve => { finish = resolve; }));
    const pending = service.checkForUpdates();
    await service.checkForUpdates();
    expect(check).toHaveBeenCalledTimes(1);
    expect(service.checking()).toBe(true);
    versions.next({ type: 'NO_NEW_VERSION_DETECTED', version: { hash: 'old' } });
    finish(false);
    await pending;
    expect(service.checking()).toBe(false);
    expect(service.message()).toContain('已是最新版本');
  });

  it('keeps a prepared update available after another check or a failure', async () => {
    service = TestBed.inject(AppUpdateService);
    versions.next(ready);
    await service.checkForUpdates();
    check.mockRejectedValueOnce(new Error('network'));
    await service.checkForUpdates();
    expect(service.needsReload()).toBe(true);
    expect(service.message()).toContain('無法完成');
    expect(service.checking()).toBe(false);
  });

  it('marks an update ready from the check result', async () => {
    service = TestBed.inject(AppUpdateService);
    check.mockResolvedValueOnce(true);
    await service.checkForUpdates();
    expect(service.updateReady()).toBe(true);
  });

  it('reports download failures and allows a later retry', async () => {
    service = TestBed.inject(AppUpdateService);
    versions.next({ type: 'VERSION_INSTALLATION_FAILED', version: { hash: 'bad' }, error: 'download' });
    expect(service.message()).toContain('下載失敗');
    await service.checkForUpdates();
    expect(service.message()).toContain('已是最新版本');
  });

  it('does not claim latest when the worker returns false without a verified result', async () => {
    service = TestBed.inject(AppUpdateService);
    check.mockResolvedValueOnce(false);
    await service.checkForUpdates();
    expect(service.message()).toContain('未能確認');
    check.mockImplementationOnce(async () => {
      versions.next({ type: 'VERSION_INSTALLATION_FAILED', version: { hash: 'bad' }, error: 'download' });
      return false;
    });
    await service.checkForUpdates();
    expect(service.message()).toContain('下載失敗');
  });

  it('shows offline status without requesting and can retry online', async () => {
    service = TestBed.inject(AppUpdateService);
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    await service.checkForUpdates();
    expect(check).not.toHaveBeenCalled();
    expect(service.message()).toContain('離線');
    vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true);
    await service.checkForUpdates();
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('preserves the reload action for an unrecoverable version', async () => {
    service = TestBed.inject(AppUpdateService);
    unrecoverable.next({ reason: 'missing chunk' });
    await service.checkForUpdates();
    expect(service.reloadRequired()).toBe(true);
    expect(service.needsReload()).toBe(true);
  });

  it('removes browser and update listeners on destruction', async () => {
    service = TestBed.inject(AppUpdateService);
    stable.next(true);
    await Promise.resolve();
    TestBed.resetTestingModule();
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('online'));
    versions.next(ready);
    unrecoverable.next({ reason: 'missing' });
    expect(check).toHaveBeenCalledTimes(1);
    expect(service.needsReload()).toBe(false);
  });

  it('does not check in an environment without service worker support', async () => {
    TestBed.overrideProvider(SwUpdate, { useValue: { isEnabled: false } });
    service = TestBed.inject(AppUpdateService);
    stable.next(true);
    await service.checkForUpdates();
    expect(check).not.toHaveBeenCalled();
    expect(service.message()).toContain('未啟用');
  });
});
