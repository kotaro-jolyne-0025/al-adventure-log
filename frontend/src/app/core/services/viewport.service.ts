import { afterNextRender, DestroyRef, inject, Injectable } from '@angular/core';

/** Keeps overlays inside the visible viewport without rebuilding page content. */
@Injectable({ providedIn: 'root' })
export class ViewportService {
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      const root = document.documentElement;
      const viewport = window.visualViewport;
      let focused: HTMLElement | null = null;
      let frame = 0;
      const rememberFocus = (event: FocusEvent) => {
        focused = event.target instanceof HTMLElement ? event.target : null;
      };
      const update = () => {
        frame = 0;
        // Pinch zoom is left to the browser; don't resize dialogs during magnification.
        const unzoomed = !viewport || Math.abs(viewport.scale - 1) < 0.01;
        const height = unzoomed ? (viewport?.height ?? window.innerHeight) : window.innerHeight;
        root.style.setProperty('--app-visible-height', `${height}px`);
        root.style.setProperty('--app-visible-top', `${unzoomed ? (viewport?.offsetTop ?? 0) : 0}px`);
        root.classList.toggle('app-short-viewport', unzoomed && height <= 600);

        if (!focused?.isConnected || focused.getClientRects().length) return;
        // Only recover focus inside a marked responsive region, and never override
        // a new visible focus (for example a dialog opened while resizing).
        const active = document.activeElement;
        if (active !== focused && active !== document.body) return;
        const scope = focused.closest('[data-resize-focus]');
        const candidates = scope?.querySelectorAll<HTMLElement>(
          '[data-resize-focus-target], button, input, textarea, mat-select, summary, a[href]',
        );
        const replacement = [...(candidates ?? [])].find(element =>
          element.getClientRects().length > 0 && !element.hasAttribute('disabled'),
        );
        replacement?.focus({ preventScroll: true });
      };
      const schedule = () => {
        if (!frame) frame = requestAnimationFrame(update);
      };
      document.addEventListener('focusin', rememberFocus);
      window.addEventListener('resize', schedule);
      viewport?.addEventListener('resize', schedule);
      viewport?.addEventListener('scroll', schedule);
      update();
      this.destroyRef.onDestroy(() => {
        document.removeEventListener('focusin', rememberFocus);
        window.removeEventListener('resize', schedule);
        viewport?.removeEventListener('resize', schedule);
        viewport?.removeEventListener('scroll', schedule);
        cancelAnimationFrame(frame);
        root.style.removeProperty('--app-visible-height');
        root.style.removeProperty('--app-visible-top');
        root.classList.remove('app-short-viewport');
      });
    });
  }
}
