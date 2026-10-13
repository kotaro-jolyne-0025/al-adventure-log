import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';

interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

@Injectable({ providedIn: 'root' })
export class AppInstallService {
  private readonly document = inject(DOCUMENT);
  private readonly destroy = inject(DestroyRef);
  private promptEvent?: InstallPrompt;
  readonly installed = signal(false);
  readonly available = computed(() => !this.installed());

  constructor() {
    const view = this.document.defaultView;
    if (!view) return;
    const standalone = view.matchMedia?.('(display-mode: standalone)');
    const updateInstalled = () => {
      this.installed.set(standalone?.matches === true || (view.navigator as Navigator & { standalone?: boolean }).standalone === true);
    };
    const onInstalled = () => {
      this.promptEvent = undefined;
      this.installed.set(true);
    };
    const onBeforeInstall = (event: Event) => {
      event.preventDefault();
      this.promptEvent = event as InstallPrompt;
    };
    updateInstalled();
      standalone?.addEventListener('change', updateInstalled);
    view.addEventListener('appinstalled', onInstalled);
    view.addEventListener('beforeinstallprompt', onBeforeInstall);
    this.destroy.onDestroy(() => {
      standalone?.removeEventListener('change', updateInstalled);
      view.removeEventListener('appinstalled', onInstalled);
      view.removeEventListener('beforeinstallprompt', onBeforeInstall);
    });
  }

  async install(): Promise<'accepted' | 'dismissed' | 'instructions'> {
    if (!this.promptEvent) return 'instructions';
    const prompt = this.promptEvent;
    this.promptEvent = undefined;
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      if (outcome === 'accepted') this.installed.set(true);
      return outcome;
    } catch {
      return 'dismissed';
    }
  }
}
