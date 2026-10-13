import { computed } from '@angular/core';
import { CacheNoticeComponent } from '../../../shared/components/cache-notice/cache-notice.component';
import { LocalReadCache, watchReadPage } from '../../../core/services/local-read-cache.service';
import { LocalStore } from '../../../core/services/local-store.service';
import { DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ReadErrorComponent, readErrorMessage } from '../../../shared/components/read-error/read-error.component';
import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';

import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CharacterService } from '../../../core/services/character.service';
import { formatClassLevels } from '../../../core/models/dnd-classes';
import { Character } from '../../../core/models/character.model';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { LucideUsers, LucidePenLine, LucideTrash2, LucidePlus, LucideUserPlus } from '@lucide/angular';

@Component({
  selector: 'app-character-list',
  standalone: true,
  imports: [
    CacheNoticeComponent,
    ReadErrorComponent,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatChipsModule,
    MatTooltipModule,
    LucideUsers, LucidePenLine, LucideTrash2, LucidePlus, LucideUserPlus
  ],
  templateUrl: './character-list.component.html',
  styleUrl: './character-list.component.scss',
})
export class CharacterListComponent implements OnInit {
  private readonly local = inject(LocalStore);
  private readonly reads = inject(LocalReadCache);
  private readonly destroy = inject(DestroyRef);
  protected readonly readSource = signal<'cloud' | 'copy' | null>(null);
  protected readonly fetchedAt = signal<number | null>(null);
  protected readonly readOnly = computed(() => this.readSource() !== 'cloud');
  private readonly refreshWatcher = watchReadPage(() => this.loadCharacters());

  private readonly characterService = inject(CharacterService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected characters = signal<Character[]>([]);
  protected isLoading = signal(true);
  protected isRefreshing = signal(false);
  protected loadError = signal<string | null>(null);
  protected hasLoaded = signal(false);

  ngOnInit(): void {
    this.loadCharacters();
  }

  protected loadCharacters(): void {
    this.readSource.set(null);
    this.loadError.set(null);
    this.isLoading.set(!this.hasLoaded());
    this.isRefreshing.set(true);
    this.reads.read('', 'characters', () => this.characterService.getAll(true)).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (result) => {
        const list = result.data;
        this.readSource.set(result.source);
        if (result.source === 'copy' && this.hasLoaded()) return;
        this.fetchedAt.set(result.fetchedAt);
        this.characters.set(list);
        this.hasLoaded.set(true);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.readSource.set(null);
        this.characters.set([]); this.hasLoaded.set(false);
        this.loadError.set(readErrorMessage(error, '角色列表'));
        this.isLoading.set(false);
        this.isRefreshing.set(false);
      },
      complete: () => this.isRefreshing.set(false),
    });
  }

  protected onCreateCharacter(): void {
    if (this.readOnly()) return;
    this.router.navigate(['/characters/new']);
  }

  protected onEditCharacter(event: Event, id: string): void {
    if (this.readOnly()) return;
    event.stopPropagation();
    this.router.navigate(['/characters', id, 'edit']);
  }

  protected onDeleteCharacter(event: Event, character: Character): void {
    if (this.readOnly()) return;
    event.stopPropagation();
    const data: ConfirmDialogData = {
      title: '刪除角色',
      intent: 'destructive',
      message: `確定要刪除「${character.characterName}」嗎？此操作將一併刪除其所有冒險記錄與倉庫物品，且無法復原。`,
      confirmText: '確認刪除',
      cancelText: '取消',
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '380px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed || this.readOnly()) return;
        this.characterService.delete(character.id).subscribe({
          next: () => {
            this.snackBar.open(`已刪除角色「${character.characterName}」`, '關閉', { duration: 3000 });
            this.loadCharacters();
          },
          error: () => {
            this.snackBar.open('刪除失敗，請稍後再試', '關閉', { duration: 3000 });
          },
        });
      });
  }

  protected formatClasses(character: Character): string {
    return formatClassLevels(character.currentClassesString) || '無職業紀錄';
  }

  protected parseTotalLevel(classesString?: string): number {
    if (!classesString || !classesString.trim()) return 1;
    let total = 0;
    const segments = classesString.split('/');
    for (const seg of segments) {
      const match = seg.match(/(\d+)$/);
      if (match) {
        try {
          total += parseInt(match[1], 10);
        } catch { }
      } else {
        total += 1;
      }
    }
    return total > 0 ? total : 1;
  }

  protected getInitial(name: string): string {
    return name ? name.trim().charAt(0).toUpperCase() : '?';
  }
}
