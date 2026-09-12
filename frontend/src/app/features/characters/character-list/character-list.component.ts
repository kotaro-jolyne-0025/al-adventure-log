import { Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CharacterService } from '../../../core/services/character.service';
import { Character } from '../../../core/models/character.model';
import {
  ConfirmDialogComponent,
  ConfirmDialogData,
} from '../../../shared/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-character-list',
  standalone: true,
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTooltipModule,
  ],
  templateUrl: './character-list.component.html',
  styleUrl: './character-list.component.scss',
})
export class CharacterListComponent implements OnInit {
  private readonly characterService = inject(CharacterService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  protected characters = signal<Character[]>([]);
  protected isLoading = signal(true);

  ngOnInit(): void {
    this.loadCharacters();
  }

  private loadCharacters(): void {
    this.isLoading.set(true);
    this.characterService.getAll().subscribe({
      next: (list) => {
        this.characters.set(list);
        this.isLoading.set(false);
      },
      error: () => {
        this.snackBar.open('載入角色列表失敗，請稍後再試', '關閉', { duration: 3000 });
        this.isLoading.set(false);
      },
    });
  }

  protected onCreateCharacter(): void {
    this.router.navigate(['/characters/new']);
  }

  protected onEditCharacter(event: Event, id: string): void {
    event.stopPropagation();
    this.router.navigate(['/characters', id, 'edit']);
  }

  protected onViewCharacter(id: string): void {
    this.router.navigate(['/characters', id, 'adventures']);
  }

  protected onDeleteCharacter(event: Event, character: Character): void {
    event.stopPropagation();
    const data: ConfirmDialogData = {
      title: '刪除角色',
      message: `確定要刪除「${character.characterName}」嗎？此操作將一併刪除其所有冒險記錄與倉庫物品，且無法復原。`,
      confirmText: '確認刪除',
      cancelText: '取消',
    };
    this.dialog
      .open(ConfirmDialogComponent, { data, width: '380px' })
      .afterClosed()
      .subscribe((confirmed) => {
        if (!confirmed) return;
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
    return character.currentClassesString || '無職業紀錄';
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
        } catch {}
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
