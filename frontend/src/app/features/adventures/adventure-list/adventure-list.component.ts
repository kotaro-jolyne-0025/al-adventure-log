import { CacheNoticeComponent } from '../../../shared/components/cache-notice/cache-notice.component';
import { LocalReadCache, watchReadPage } from '../../../core/services/local-read-cache.service';
import { LocalStore } from '../../../core/services/local-store.service';
import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReadErrorComponent, readErrorMessage } from '../../../shared/components/read-error/read-error.component';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AdventureService } from '../../../core/services/adventure.service';
import { AdventureEntry } from '../../../core/models/adventure.model';

import {
  LucideCoins,
  LucideTent,
  LucideSparkles,
  LucideSlidersHorizontal,
  LucideChevronDown,
  LucideArrowDown,
  LucideArrowUp,
  LucideClock,
  LucidePlus,
  LucideBookOpen,
  LucideCalendar,
  LucideUser,
  LucideChevronRight,
  LucideSearch,
  LucideX,
  LucideStar,
} from '@lucide/angular';

export type AdventureSortField = 'playDate' | 'createdAt';

@Component({
  selector: 'app-adventure-list',
  standalone: true,
  imports: [
    CacheNoticeComponent,
    ReadErrorComponent,
    RouterLink,
    CommonModule,
    DatePipe,
    MatButtonModule,
    MatTooltipModule,
    LucideCoins,
    LucideTent,
    LucideSparkles,
    LucideSlidersHorizontal,
    LucideChevronDown,
    LucideArrowDown,
    LucideArrowUp,
    LucideClock,
    LucidePlus,
    LucideBookOpen,
    LucideCalendar,
    LucideUser,
    LucideChevronRight,
    LucideSearch,
    LucideX,
    LucideStar,
  ],
  templateUrl: './adventure-list.component.html',
  styleUrl: './adventure-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdventureListComponent implements OnInit {
  private readonly local = inject(LocalStore);
  private readonly reads = inject(LocalReadCache);
  private readonly destroy = inject(DestroyRef);
  protected readonly readSource = signal<'cloud' | 'copy' | null>(null);
  protected readonly fetchedAt = signal<number | null>(null);
  protected readonly readOnly = computed(() => this.readSource() !== 'cloud' || !this.local.freshCharacters().has(this.characterId));
  private readonly refreshWatcher = watchReadPage(() => this.loadEntries());

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly adventureService = inject(AdventureService);
  private readonly snackBar = inject(MatSnackBar);

  private readonly SORT_FIELD_KEY = 'dnd_adv_list_sort_field';
  private readonly SORT_ORDER_KEY = 'dnd_adv_list_sort_order';

  protected readonly rawEntries = signal<AdventureEntry[]>([]);
  protected readonly searchQuery = signal('');
  protected readonly sortField = signal<AdventureSortField>(
    (() => {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem(this.SORT_FIELD_KEY);
        if (stored === 'playDate' || stored === 'createdAt') return stored;
      }
      return 'playDate';
    })()
  );
  protected readonly sortOrder = signal<'desc' | 'asc'>(
    (typeof localStorage !== 'undefined' &&
      (localStorage.getItem(this.SORT_ORDER_KEY) as 'desc' | 'asc')) ||
    'desc'
  );
  protected readonly isLoading = signal(true);
  protected readonly isRefreshing = signal(false);
  protected loadError = signal<string | null>(null);
  protected hasLoaded = signal(false);
  private readonly pageSize = 20;
  protected readonly visibleLimit = signal(this.pageSize);
  protected characterId!: string;

  protected readonly sortFieldLabel = computed(() => {
    return this.sortField() === 'playDate' ? '遊玩日期' : '建立時間';
  });

  protected readonly directionLabel = computed(() => {
    return this.sortOrder() === 'desc' ? '由新至舊' : '由舊至新';
  });

  protected readonly directionTooltip = computed(() => {
    return this.sortOrder() === 'desc'
      ? '目前：由新至舊（點擊切換為由舊至新）'
      : '目前：由舊至新（點擊切換為由新至舊）';
  });

  /** 排序後的完整清單 */
  private readonly sortedEntries = computed(() => {
    const field = this.sortField();
    const order = this.sortOrder();
    const list = [...this.rawEntries()];
    return list.sort((a, b) => {
      const diff = this.compareEntries(a, b, field);
      return order === 'desc' ? diff : -diff;
    });
  });

  /** 排序 + 搜尋過濾後的最終清單 */
  protected readonly entries = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.sortedEntries();
    return this.sortedEntries().filter(e =>
      (e.adventureName ?? '').toLowerCase().includes(q) ||
      (e.adventureCode ?? '').toLowerCase().includes(q) ||
      (e.dmName ?? '').toLowerCase().includes(q) ||
      (e.storyAwards?.some(a => (a.awardName ?? '').toLowerCase().includes(q)))
    );
  });

  /** 手機一次只建立 20 張卡片，避免長清單一次塞入過多 DOM。 */
  protected readonly visibleEntries = computed(() =>
    this.entries().slice(0, this.visibleLimit())
  );

  protected readonly hasMoreEntries = computed(() =>
    this.visibleLimit() < this.entries().length
  );

  /** 是否正在搜尋中（有輸入關鍵字）*/
  protected readonly isSearching = computed(() => this.searchQuery().trim().length > 0);

  protected clearSearch(): void {
    this.searchQuery.set('');
    this.visibleLimit.set(this.pageSize);
  }

  protected onSearchChange(value: string): void {
    this.searchQuery.set(value);
    this.visibleLimit.set(this.pageSize);
  }

  protected showMoreEntries(): void {
    this.visibleLimit.update(limit => limit + this.pageSize);
  }

  private compareEntries(a: AdventureEntry, b: AdventureEntry, field: AdventureSortField): number {
    const primaryA = field === 'playDate' ? this.getTime(a.playDate) : this.getTime(a.createdAt);
    const primaryB = field === 'playDate' ? this.getTime(b.playDate) : this.getTime(b.createdAt);
    const diff = primaryB - primaryA;
    if (diff !== 0) return diff;

    const secondaryA = field === 'playDate' ? this.getTime(a.createdAt) : this.getTime(a.playDate);
    const secondaryB = field === 'playDate' ? this.getTime(b.createdAt) : this.getTime(b.playDate);
    return secondaryB - secondaryA;
  }

  private getTime(val?: string | Date | null): number {
    return val ? new Date(val).getTime() : 0;
  }

  ngOnInit(): void {
    this.characterId =
      this.route.parent?.snapshot.paramMap.get('id') ??
      this.route.snapshot.paramMap.get('id') ?? '';
    this.loadEntries();
  }

  protected loadEntries(): void {
    this.readSource.set(null);
    this.loadError.set(null);
    this.isLoading.set(!this.hasLoaded());
    this.isRefreshing.set(true);
    this.reads.read(this.characterId, 'adventures', () => this.adventureService.getAllByCharacter(this.characterId, true)).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (result) => {
        const list = result.data;
        this.readSource.set(result.source);
        if (result.source === 'copy' && this.hasLoaded()) return;
        this.fetchedAt.set(result.fetchedAt);
        this.rawEntries.set(list);
        this.hasLoaded.set(true);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.readSource.set(null);
        this.rawEntries.set([]); this.hasLoaded.set(false);
        this.loadError.set(readErrorMessage(error, '冒險紀錄'));
        this.isLoading.set(false);
        this.isRefreshing.set(false);
      },
      complete: () => this.isRefreshing.set(false),
    });
  }

  protected onSortFieldChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const field = target.value as AdventureSortField;
    this.sortField.set(field);
    this.visibleLimit.set(this.pageSize);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(this.SORT_FIELD_KEY, field);
      } catch { }
    }
  }

  protected toggleSortOrder(): void {
    const nextOrder = this.sortOrder() === 'desc' ? 'asc' : 'desc';
    this.sortOrder.set(nextOrder);
    this.visibleLimit.set(this.pageSize);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(this.SORT_ORDER_KEY, nextOrder);
      } catch { }
    }
  }

  protected onAddEntry(): void {
    if (this.readOnly()) return;
    this.router.navigate(['/characters', this.characterId, 'adventures', 'new']);
  }

  protected formatGoldChange(entry: AdventureEntry): string | null {
    const change = Math.round(((entry.goldChange ?? 0) + (entry.goldDowntimeChange ?? 0)) * 100) / 100;
    if (change === 0 && entry.goldChange == null && entry.goldDowntimeChange == null) return null;
    return change >= 0 ? `+${change} 金` : `${change} 金`;
  }

  protected formatDowntimeChange(entry: AdventureEntry): string | null {
    const change = (entry.downtimeChange ?? 0) + (entry.downtimeDowntimeChange ?? 0);
    if (change === 0 && entry.downtimeChange == null && entry.downtimeDowntimeChange == null) return null;
    return change >= 0 ? `+${change} 天` : `${change} 天`;
  }

  protected formatMagicItemChange(entry: AdventureEntry): string | null {
    const change = (entry.magicItemsChange ?? 0) + (entry.magicItemsDowntimeChange ?? 0);
    if (change === 0 && entry.magicItemsChange == null && entry.magicItemsDowntimeChange == null) return null;
    return change >= 0 ? `+${change} 魔法物品` : `${change} 魔法物品`;
  }

  protected getLevelProgress(entry: AdventureEntry): string {
    const start = entry.startingLevel;
    const end = entry.endingLevel;
    if (start != null && end != null) {
      if (end > start) {
        return `Lv.${start} ➔ Lv.${end}`;
      }
      return `Lv.${end}`;
    }
    if (end != null) return `Lv.${end}`;
    if (start != null) return `Lv.${start}`;
    return '—';
  }
}
