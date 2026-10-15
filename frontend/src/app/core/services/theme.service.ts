import { Injectable, signal, computed, effect } from '@angular/core';

export type AppTheme = 'light' | 'dark';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly THEME_KEY = 'dnd_theme';

  // Signals
  readonly currentTheme = signal<AppTheme>(this.getStoredTheme());
  readonly isDark = computed(() => this.currentTheme() === 'dark');

  constructor() {
    // 監聽 theme 變化並即時套用至 body class 與 meta theme-color
    effect(() => {
      const theme = this.currentTheme();
      this.applyTheme(theme);
    });
  }

  toggleTheme(): void {
    const nextTheme: AppTheme = this.currentTheme() === 'light' ? 'dark' : 'light';
    this.setTheme(nextTheme);
  }

  setTheme(theme: AppTheme): void {
    this.currentTheme.set(theme);
    localStorage.setItem(this.THEME_KEY, theme);
  }

  private applyTheme(theme: AppTheme): void {
    const body = document.body;
    if (theme === 'dark') {
      body.classList.remove('theme-light');
      body.classList.add('theme-dark');
      this.updateMetaThemeColor('#18181b');
    } else {
      body.classList.remove('theme-dark');
      body.classList.add('theme-light');
      this.updateMetaThemeColor('#ffffff');
    }
  }

  private updateMetaThemeColor(color: string): void {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', color);
    }
  }

  private getStoredTheme(): AppTheme {
    const stored = localStorage.getItem(this.THEME_KEY) as AppTheme | null;
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
    // 預設為 light（風格 A），若使用者系統偏好為深色則可自動偵測
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  }
}
