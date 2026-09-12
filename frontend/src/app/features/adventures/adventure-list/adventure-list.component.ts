import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
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
} from '@lucide/angular';

export type AdventureSortField = 'playDate' | 'createdAt';

@Component({
  selector: 'app-adventure-list',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
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
  ],
  templateUrl: './adventure-list.component.html',
  styleUrl: './adventure-list.component.scss',
})
export class AdventureListComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly adventureService = inject(AdventureService);
  private readonly snackBar = inject(MatSnackBar);

  private readonly SORT_FIELD_KEY = 'dnd_adv_list_sort_field';
  private readonly SORT_ORDER_KEY = 'dnd_adv_list_sort_order';

  protected readonly rawEntries = signal<AdventureEntry[]>([]);
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

  protected readonly entries = computed(() => {
    const field = this.sortField();
    const order = this.sortOrder();
    const list = [...this.rawEntries()];

    return list.sort((a, b) => {
      const diff = this.compareEntries(a, b, field);
      return order === 'desc' ? diff : -diff;
    });
  });

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

  private loadEntries(): void {
    this.isLoading.set(true);
    this.adventureService.getAllByCharacter(this.characterId).subscribe({
      next: (list) => {
        this.rawEntries.set(list);
        this.isLoading.set(false);
      },
      error: () => {
        this.snackBar.open('載入冒險記錄失敗', '關閉', { duration: 3000 });
        this.isLoading.set(false);
      },
    });
  }

  protected onSortFieldChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const field = target.value as AdventureSortField;
    this.sortField.set(field);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(this.SORT_FIELD_KEY, field);
      } catch {}
    }
  }

  protected toggleSortOrder(): void {
    const nextOrder = this.sortOrder() === 'desc' ? 'asc' : 'desc';
    this.sortOrder.set(nextOrder);
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(this.SORT_ORDER_KEY, nextOrder);
      } catch {}
    }
  }

  protected onAddEntry(): void {
    this.router.navigate(['/characters', this.characterId, 'adventures', 'new']);
  }

  protected onViewEntry(entryId: string): void {
    this.router.navigate(['/characters', this.characterId, 'adventures', entryId]);
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
