import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { EMPTY } from 'rxjs';
import { Subject } from 'rxjs';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { App } from './app';
import { version } from '../../package.json';
import { siteLinks } from './core/config/site-links';

describe('App', () => {
  let snackAction: Subject<void>;
  const openSnack = vi.fn((..._args: unknown[]) => ({ onAction: () => snackAction }));
  beforeEach(async () => {
    snackAction = new Subject<void>();
    openSnack.mockClear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        { provide: MatSnackBar, useValue: { open: openSnack } },
        {
          provide: SwUpdate,
          useValue: { isEnabled: false, versionUpdates: EMPTY },
        },
      ],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it.each([false, true])('provides public support links and restores menu focus (logged in: %s)', async loggedIn => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    if (loggedIn) {
      app.authService.currentUser.set({ id: 'test-user', displayName: '測試玩家', email: 'player@example.invalid' });
      app.authService.token.set('test-token');
    }
    fixture.detectChanges();
    const trigger = fixture.nativeElement.querySelector(loggedIn ? '.user-pill-btn' : '.more-menu-btn') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const link = document.querySelector('.mat-mdc-menu-panel a[target="_blank"]') as HTMLAnchorElement;
    expect(link.href).toBe(siteLinks.sponsorshipUrl);
    expect(link.rel).toBe('noopener noreferrer');
    const contact = Array.from(document.querySelectorAll<HTMLButtonElement>('.mat-mdc-menu-panel button')).find(button => button.textContent?.trim() === '聯絡我')!;
    const closed = new Subject<void>();
    vi.spyOn(TestBed.inject(MatDialog), 'open').mockReturnValue({ afterClosed: () => closed } as never);
    const focus = vi.spyOn(trigger, 'focus');
    contact.click();
    closed.next();
    expect(focus).toHaveBeenCalled();
  });

  it('should render the product title', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.brand-title')?.textContent).toContain('冒險紀錄表 Web版');
  });

  it.each([false, true])('keeps version and update actions in the menu (logged in: %s)', async loggedIn => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    if (loggedIn) {
      app.authService.currentUser.set({ id: 'test-user', displayName: '測試玩家', email: 'player@example.invalid' });
      app.authService.token.set('test-token');
    }
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.app-update-panel')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain(`v${version}`);
    const trigger = fixture.nativeElement.querySelector(loggedIn ? '.user-pill-btn' : '.more-menu-btn') as HTMLButtonElement;
    trigger.click();
    fixture.detectChanges();
    await fixture.whenStable();
    const menu = document.querySelector('[role="menu"]') as HTMLElement;
    expect(menu.textContent).toContain(`v${version}`);
    expect(menu.textContent).toContain('檢查更新');
    const checkButton = Array.from(menu.querySelectorAll('button')).find(button => button.textContent?.includes('檢查更新'));
    expect(checkButton?.disabled).toBe(true);
    app.appUpdate.updateReady.set(true);
    fixture.detectChanges();
    openSnack('其他操作完成', '關閉');
    app.appUpdate.message.set('目前已是最新版本。');
    fixture.detectChanges();
    expect(menu.textContent).toContain('重新整理以更新');
    const confirm = vi.spyOn(app, 'confirmUpdate').mockImplementation(() => {});
    Array.from(menu.querySelectorAll('button')).find(button => button.textContent?.includes('重新整理以更新'))?.click();
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it('only notifies when an update becomes ready and routes its action through confirmation', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const confirm = vi.spyOn(app, 'confirmUpdate').mockImplementation(() => {});
    fixture.detectChanges();
    app.appUpdate.message.set('目前已是最新版本。');
    fixture.detectChanges();
    expect(openSnack).not.toHaveBeenCalled();
    app.appUpdate.updateReady.set(true);
    fixture.detectChanges();
    expect(openSnack).toHaveBeenCalledExactlyOnceWith('新版已準備好，可重新整理以更新。', '重新整理', {
      duration: 8000, verticalPosition: 'top', horizontalPosition: 'right',
    });
    app.appUpdate.message.set('無法完成更新檢查。');
    fixture.detectChanges();
    expect(openSnack).toHaveBeenCalledTimes(1);
    snackAction.next();
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it('shows a reload reminder for an unrecoverable cache', () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.appUpdate.reloadRequired.set(true);
    fixture.detectChanges();
    expect(openSnack).toHaveBeenCalledWith(expect.stringContaining('需要重新載入'), '重新整理', expect.anything());
  });

  it.each(['目前已是最新版本。', '目前離線，連線後可再檢查更新。', '無法完成更新檢查。'])('reports manual check results: %s', async message => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    vi.spyOn(app.appUpdate, 'checkForUpdates').mockImplementation(async () => { app.appUpdate.message.set(message); });
    await app.checkForUpdates();
    expect(openSnack).toHaveBeenCalledWith(message, '關閉', expect.objectContaining({ duration: 3000 }));
  });

  it('does not duplicate the automatic notice when a manual check downloads an update', async () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    fixture.detectChanges();
    vi.spyOn(app.appUpdate, 'checkForUpdates').mockImplementation(async () => { app.appUpdate.updateReady.set(true); });
    await app.checkForUpdates();
    fixture.detectChanges();
    expect(openSnack).toHaveBeenCalledTimes(1);
    await app.checkForUpdates();
    expect(openSnack).toHaveBeenCalledTimes(2);
  });

  it('reloads only after confirmation, with cancellation keeping the action available', () => {
    const closed = new Subject<boolean | undefined>();
    const open = vi.fn(() => ({ afterClosed: () => closed }));
    TestBed.overrideProvider(MatDialog, { useValue: { open } });
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    const reload = vi.spyOn(app.appUpdate, 'reload').mockImplementation(() => {});
    app.confirmUpdate();
    expect(open).not.toHaveBeenCalled();
    app.appUpdate.updateReady.set(true);
    app.confirmUpdate();
    app.confirmUpdate();
    expect(open).toHaveBeenCalledTimes(1);
    expect(open).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      autoFocus: 'button', data: expect.objectContaining({ message: expect.stringContaining('尚未儲存') }),
    }));
    closed.next(undefined);
    expect(reload).not.toHaveBeenCalled();
    expect(app.appUpdate.needsReload()).toBe(true);
    app.confirmUpdate();
    closed.next(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
