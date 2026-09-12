import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CharacterService } from '../../../core/services/character.service';
import { AdventureService } from '../../../core/services/adventure.service';
import { InventoryService } from '../../../core/services/inventory.service';
import { Character } from '../../../core/models/character.model';
import { EntryDefaults } from '../../../core/models/adventure.model';
import { catchError, filter, forkJoin, of, Subject, takeUntil } from 'rxjs';

import { CommonModule } from '@angular/common';

import { LucideCoins, LucideTent, LucideSparkles } from '@lucide/angular';

@Component({
  selector: 'app-character-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    MatTabsModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    LucideCoins,
    LucideTent,
    LucideSparkles,
  ],
  templateUrl: './character-shell.component.html',
  styleUrl: './character-shell.component.scss',
})
export class CharacterShellComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly characterService = inject(CharacterService);
  private readonly adventureService = inject(AdventureService);
  private readonly inventoryService = inject(InventoryService);
  private readonly snackBar = inject(MatSnackBar);

  protected character = signal<Character | null>(null);
  protected defaults = signal<EntryDefaults | null>(null);
  protected magicItemsCount = signal<number>(0);
  protected isLoading = signal(true);
  protected characterId!: string;

  private readonly destroy$ = new Subject<void>();
  private initialLoadDone = false;

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

    // 子路由切換導航完成時，自動刷新統計（忽略初次載入，避免重複打 API）
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        if (this.initialLoadDone) {
          this.refreshHud();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadCharacterData(): void {
    this.isLoading.set(true);
    forkJoin({
      character: this.characterService.getById(this.characterId),
      defaults: this.adventureService.getDefaults(this.characterId).pipe(catchError(() => of(null))),
      inventory: this.inventoryService.getAllByCharacter(this.characterId).pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ character, defaults, inventory }) => {
        this.character.set(character);
        if (defaults) {
          this.defaults.set(defaults);
        }
        const count = (inventory ?? [])
          .filter((i) => i.itemType === 'PERMANENT')
          .reduce((sum, i) => sum + (i.quantity || 1), 0);
        this.magicItemsCount.set(count);
        this.isLoading.set(false);
        this.initialLoadDone = true;
      },
      error: () => {
        this.snackBar.open('找不到此角色', '關閉', { duration: 3000 });
        this.router.navigate(['/characters']);
      },
    });
  }

  private refreshHud(): void {
    forkJoin({
      character: this.characterService.getById(this.characterId).pipe(catchError(() => of(null))),
      defaults: this.adventureService.getDefaults(this.characterId).pipe(catchError(() => of(null))),
      inventory: this.inventoryService.getAllByCharacter(this.characterId).pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ character, defaults, inventory }) => {
        if (character) this.character.set(character);
        if (defaults) this.defaults.set(defaults);
        if (inventory) {
          const count = inventory
            .filter((i) => i.itemType === 'PERMANENT')
            .reduce((sum, i) => sum + (i.quantity || 1), 0);
          this.magicItemsCount.set(count);
        }
      },
    });
  }

  protected formatClasses(character: Character): string {
    return character.currentClassesString || '無職業紀錄';
  }

  protected parseTotalLevel(): number {
    if (this.defaults()?.startingLevel) {
      return this.defaults()!.startingLevel!;
    }
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
    this.router.navigate(['/characters', this.characterId, 'edit']);
  }
}
