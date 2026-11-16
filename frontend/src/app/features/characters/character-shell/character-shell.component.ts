import { ReadErrorComponent, readErrorMessage } from '../../../shared/components/read-error/read-error.component';
import { Component, DestroyRef, ElementRef, computed, effect, inject, OnInit, signal, viewChild } from '@angular/core';
import { CacheNoticeComponent } from '../../../shared/components/cache-notice/cache-notice.component';
import { LocalReadCache, watchReadPage } from '../../../core/services/local-read-cache.service';
import { LocalStore } from '../../../core/services/local-store.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet, RouterLink } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CharacterService } from '../../../core/services/character.service';
import { formatClassLevels } from '../../../core/models/dnd-classes';
import { Character } from '../../../core/models/character.model';

import { CommonModule } from '@angular/common';

import { LucideCoins, LucideTent, LucideSparkles, LucideGhost, LucidePencil, LucideBookOpen, LucideBox, LucideChevronDown, LucideHistory } from '@lucide/angular';

@Component({
  selector: 'app-character-shell',
  standalone: true,
  imports: [
    CacheNoticeComponent,
    ReadErrorComponent,
    CommonModule,
    RouterOutlet,
    RouterLink,
    MatButtonModule,
    MatTooltipModule,
    LucideCoins,
    LucideTent,
    LucideSparkles,
    LucideGhost,
    LucidePencil, LucideBookOpen, LucideBox, LucideChevronDown, LucideHistory
  ],
  templateUrl: './character-shell.component.html',
  styleUrl: './character-shell.component.scss',
})
export class CharacterShellComponent implements OnInit {
  private readonly local = inject(LocalStore);
  private readonly reads = inject(LocalReadCache);
  private readonly destroy = inject(DestroyRef);
  protected readonly readSource = signal<'cloud' | 'copy' | null>(null);
  protected readonly fetchedAt = signal<number | null>(null);
  protected readonly readOnly = computed(() => this.readSource() !== 'cloud');
  private readSubscription?: import('rxjs').Subscription;
  private readGeneration = -1;
  private readonly refreshWatcher = watchReadPage(reason => {
    if (reason === 'offline' || reason === 'invalidated' || navigator.onLine !== false) {
      this.loadCharacterData(reason === 'online' && this.readSource() !== 'cloud');
    }
  }, {
    state: () => this.isLoading() ? 'pending' :
      this.readSource() ?? 'failed',
    retry: () => this.loadCharacterData(true),
  });
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly characterService = inject(CharacterService);
  private readonly snackBar = inject(MatSnackBar);

  protected character = signal<Character | null>(null);
  private characterOwner: string | null = null;
  protected isLoading = signal(true);
  protected isRefreshing = signal(false);
  protected loadError = signal<string | null>(null);
  protected retryable = signal(true);
  protected characterId!: string;
  readonly activeTab = signal(0);
  private readonly bottomNav = viewChild<ElementRef<HTMLElement>>('bottomNav');
  readonly bottomNavHeight = signal<number | null>(null);
  private readonly trackBottomNav = effect(onCleanup => {
    const nav = this.bottomNav()?.nativeElement;
    if (!nav) {
      this.bottomNavHeight.set(null);
      return;
    }
    const observer = new ResizeObserver(() => this.bottomNavHeight.set(nav.offsetHeight || null));
    observer.observe(nav, { box: 'border-box' });
    onCleanup(() => observer.disconnect());
  });

  ngOnInit(): void {
    this.characterId = this.route.snapshot.paramMap.get('id')!;
    this.activeTab.set(this.getActiveTab());
    this.router.events?.pipe(takeUntilDestroyed(this.destroy)).subscribe(event => {
      if (event instanceof NavigationEnd) this.activeTab.set(this.getActiveTab());
    });
    this.loadCharacterData();
    this.route.paramMap?.pipe(takeUntilDestroyed(this.destroy)).subscribe(params => {
      const id = params.get('id');
      if (!id || id === this.characterId) return;
      this.characterId = id;
      this.retryable.set(true);
      this.character.set(null);
      this.loadCharacterData();
    });

    this.local.sessionChanged.pipe(takeUntilDestroyed(this.destroy)).subscribe(() => {
      this.readSubscription?.unsubscribe();
      this.character.set(null);
      this.readSource.set(null);
    });

  }

  protected loadCharacterData(refresh = false): void {
    this.readSubscription?.unsubscribe();
    if (navigator.onLine === false && this.local.owner() &&
        this.readGeneration === this.local.currentGeneration() && this.character()) {
      this.readSource.set('copy');
      this.isRefreshing.set(false);
      this.isLoading.set(false);
      this.loadError.set(null);
      this.local.markFresh(this.characterId, false);
      return;
    }
    const id = this.characterId;
    this.local.markFresh(id, false);
    this.readSource.set(null);
    this.loadError.set(null);
    this.isLoading.set(true);
    this.isRefreshing.set(true);
    this.readSubscription = this.reads.read(id, 'character', () => this.characterService.getById(id, refresh), refresh)
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (result) => {
        if (id !== this.characterId) return;
        this.retryable.set(true);
        this.readSource.set(result.source);
        this.local.markFresh(this.characterId, result.source === 'cloud');
        this.readGeneration = this.local.currentGeneration();
        this.fetchedAt.set(result.fetchedAt);
        this.characterOwner = this.local.owner();
        this.character.set(result.data);
        this.isLoading.set(false);
      },
      error: (error) => {
        if (id !== this.characterId) return;
        this.readSource.set(null);
        this.character.set(null);
        this.isLoading.set(false);
        this.isRefreshing.set(false);
        this.retryable.set(![401, 403, 404].includes(error.status));
        this.loadError.set(readErrorMessage(error, '角色'));
      },
      complete: () => { if (id === this.characterId) this.isRefreshing.set(false); },
    });
  }


  protected formatClasses(character: Character): string {
    return formatClassLevels(character.currentClassesString) || '無職業紀錄';
  }

  protected parseTotalLevel(): number {
    const str = this.character()?.currentClassesString;
    if (!str) return 1;
    let total = 0;
    const segments = str.split('/');
    for (const seg of segments) {
      const match = seg.match(/(\d+)$/);
      if (match) {
        try {
          total += parseInt(match[1], 10);
        } catch {}
      } else {
        total += 1;
      }
    }
    return total > 0 ? total : 1;
  }

  protected getInitial(name?: string): string {
    return name ? name.trim().charAt(0).toUpperCase() : '?';
  }

  private getActiveTab(): number {
    const child = this.route.firstChild?.snapshot;
    if (child?.url[0]?.path !== 'inventory') return 0;
    return child.routeConfig?.path === 'inventory' && child.queryParamMap.get('view') === 'history' ? 2 : 1;
  }

  protected hideCharacterCard(): boolean {
    return this.isFormRoute() || this.route.firstChild?.routeConfig?.path === 'adventures/:entryId';
  }

  protected currentCharacterName(): string | undefined {
    const character = this.character();
    if (this.characterOwner && this.characterOwner === this.local.owner() &&
      character?.id === this.route.snapshot.paramMap.get('id')) {
      return character?.characterName;
    }
    return undefined;
  }

  get toolbarNavigationId(): string | undefined {
    const character = this.character();
    if (!character || this.isFormRoute() || !this.characterOwner || this.characterOwner !== this.local.owner()) {
      return undefined;
    }
    return character.id === this.route.snapshot.paramMap.get('id') ? character.id : undefined;
  }

  protected isFormRoute(): boolean {
    const segments = this.route.firstChild?.snapshot.url;
    const last = segments?.at(-1)?.path;
    return last === 'new' || last === 'edit';
  }

  protected keepContentFocusVisible(event: FocusEvent): void {
    if (!(event.target instanceof HTMLElement) || !(event.currentTarget instanceof HTMLElement)) return;
    const shell = event.currentTarget.parentElement;
    if (!shell || !window.matchMedia('(max-width: 600px)').matches) return;

    const focused = event.target.getBoundingClientRect();
    const top = document.querySelector('.app-header')?.getBoundingClientRect().bottom ?? 0;
    const navigation = shell.querySelector('.character-bottom-nav');
    const bottom = navigation?.getBoundingClientRect().top ?? window.innerHeight;
    if (focused.top < top || focused.bottom > bottom) {
      event.target.scrollIntoView({ block: 'center', inline: 'nearest' });
    }
  }

  protected onBack(): void {
    this.router.navigate(['/characters']);
  }

  protected onEdit(): void {
    if (this.readOnly()) return;
    this.router.navigate(['/characters', this.characterId, 'edit']);
  }
}
