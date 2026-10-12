import { ReadErrorComponent, readErrorMessage } from '../../../shared/components/read-error/read-error.component';
import { Component, DestroyRef, computed, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { CacheNoticeComponent } from '../../../shared/components/cache-notice/cache-notice.component';
import { LocalReadCache, watchReadPage } from '../../../core/services/local-read-cache.service';
import { LocalStore } from '../../../core/services/local-store.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterOutlet, RouterLink } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';

import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CharacterService } from '../../../core/services/character.service';
import { formatClassLevels } from '../../../core/models/dnd-classes';
import { Character } from '../../../core/models/character.model';
import { Subject, takeUntil } from 'rxjs';

import { CommonModule } from '@angular/common';

import { LucideCoins, LucideTent, LucideSparkles, LucideGhost, LucidePencil, LucideBookOpen, LucideBox } from '@lucide/angular';

@Component({
  selector: 'app-character-shell',
  standalone: true,
  imports: [
    CacheNoticeComponent,
    ReadErrorComponent,
    CommonModule,
    RouterOutlet,
    RouterLink,
    MatTabsModule,
    MatButtonModule,
    MatTooltipModule,
    MatProgressSpinner,
    LucideCoins,
    LucideTent,
    LucideSparkles,
    LucideGhost,
    LucidePencil, LucideBookOpen, LucideBox
  ],
  templateUrl: './character-shell.component.html',
  styleUrl: './character-shell.component.scss',
})
export class CharacterShellComponent implements OnInit, OnDestroy {
  private readonly local = inject(LocalStore);
  private readonly reads = inject(LocalReadCache);
  private readonly destroy = inject(DestroyRef);
  protected readonly readSource = signal<'cloud' | 'copy' | null>(null);
  protected readonly fetchedAt = signal<number | null>(null);
  protected readonly readOnly = computed(() => this.readSource() !== 'cloud');
  private readonly refreshWatcher = watchReadPage(() => this.loadCharacterData());
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly characterService = inject(CharacterService);
  private readonly snackBar = inject(MatSnackBar);

  protected character = signal<Character | null>(null);
  protected isLoading = signal(true);
  protected loadError = signal<string | null>(null);
  protected retryable = signal(true);
  protected characterId!: string;

  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.characterId = this.route.snapshot.paramMap.get('id')!;
    this.loadCharacterData();

    // 🌟 即時響應所有資料異動（新增/編輯/刪除冒險記錄、消耗品使用、道具增刪），即時更新頂部 HUD
    this.characterService.characterChanged$
      .pipe(takeUntil(this.destroy$))
      .subscribe((id) => {
        if (!id || id === this.characterId) {
          this.refreshHud();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected loadCharacterData(): void {
    this.local.markFresh(this.characterId, false);
    this.readSource.set(null);
    this.character.set(null);
    this.loadError.set(null);
    this.isLoading.set(true);
    this.reads.read(this.characterId, 'character', () => this.characterService.getById(this.characterId, true))
      .pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (result) => {
        this.readSource.set(result.source); this.fetchedAt.set(result.fetchedAt);
        this.local.markFresh(this.characterId, result.source === 'cloud');
        this.character.set(result.data);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.retryable.set(![401, 403, 404].includes(error.status));
        this.loadError.set(readErrorMessage(error, '角色'));
      },
    });
  }

  private refreshHud(): void {
    this.loadCharacterData();
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

  protected onTabChange(index: number): void {
    if (index === 0) {
      this.router.navigate(['/characters', this.characterId, 'adventures']);
    } else {
      this.router.navigate(['/characters', this.characterId, 'inventory']);
    }
  }

  protected getActiveTab(): number {
    const url = this.router.url;
    return url.includes('/inventory') ? 1 : 0;
  }

  protected onBack(): void {
    this.router.navigate(['/characters']);
  }

  protected onEdit(): void {
    if (this.readOnly()) return;
    this.router.navigate(['/characters', this.characterId, 'edit']);
  }
}
