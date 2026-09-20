import { Component, inject, OnInit, OnDestroy, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterOutlet } from '@angular/router';
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

import { LucideCoins, LucideTent, LucideSparkles, LucidePencil, LucideBookOpen, LucideBox, LucideGhost } from '@lucide/angular';

@Component({
  selector: 'app-character-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    MatTabsModule,
    MatButtonModule,
    MatTooltipModule,
    MatProgressSpinner,
    LucideCoins,
    LucideTent,
    LucideSparkles,
    LucidePencil, LucideBookOpen, LucideBox, LucideGhost
  ],
  templateUrl: './character-shell.component.html',
  styleUrl: './character-shell.component.scss',
})
export class CharacterShellComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly characterService = inject(CharacterService);
  private readonly snackBar = inject(MatSnackBar);

  protected character = signal<Character | null>(null);
  protected isLoading = signal(true);
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

  private loadCharacterData(): void {
    this.isLoading.set(true);
    this.characterService.getById(this.characterId).subscribe({
      next: (character) => {
        this.character.set(character);
        this.isLoading.set(false);
      },
      error: () => {
        this.snackBar.open('找不到此角色', '關閉', { duration: 3000 });
        this.router.navigate(['/characters']);
      },
    });
  }

  private refreshHud(): void {
    this.characterService.getById(this.characterId).subscribe({
      next: (character) => {
        this.character.set(character);
        this.isLoading.set(false);
      },
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
