import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CharacterService } from '../../../core/services/character.service';
import { CharacterRequest } from '../../../core/models/character.model';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-character-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
  ],
  templateUrl: './character-form.component.html',
  styleUrl: './character-form.component.scss',
})
export class CharacterFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly characterService = inject(CharacterService);
  private readonly authService = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly CLASS_OPTIONS = [
    '戰士', '法師', '牧師', '遊蕩者', '遊俠',
    '吟遊詩人', '德魯伊', '武僧', '聖騎士', '契術師',
    '術士', '野蠻人', '奇械師',
  ];

  protected isEditMode = signal(false);
  protected isSaving = signal(false);
  private characterId: string | null = null;

  protected form: FormGroup = this.fb.group({
    characterName: ['', Validators.required],
    playerName: [this.authService.currentUser()?.displayName || '', Validators.required],
    race: ['', Validators.required],
    faction: [''],
  });

  // 職業等級選擇器
  protected classEntries = signal<{ className: string; level: number }[]>([
    { className: '', level: 1 },
  ]);

  protected addClass(): void {
    this.classEntries.update(list => [...list, { className: '', level: 1 }]);
  }

  protected removeClass(index: number): void {
    this.classEntries.update(list => list.filter((_, i) => i !== index));
  }

  protected totalLevel = computed(() =>
    this.classEntries().reduce((sum, e) => sum + (e.level || 0), 0)
  );

  protected updateClassName(index: number, value: string): void {
    this.classEntries.update(list =>
      list.map((e, i) => i === index ? { ...e, className: value } : e)
    );
  }

  protected updateClassLevel(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const num = parseInt(input.value, 10);
    if (isNaN(num) || num < 1) return;
    this.classEntries.update(list =>
      list.map((e, i) => i === index ? { ...e, level: num } : e)
    );
  }

  private buildClassesString(): string | null {
    const filled = this.classEntries().filter(e => e.className.trim());
    if (filled.length === 0) return null;
    return filled.map(e => `${e.className.trim()}${e.level}`).join('/');
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.isEditMode.set(true);
      this.characterId = id;
      this.loadCharacter(this.characterId);
    } else {
      const user = this.authService.currentUser();
      if (user?.displayName && !this.form.get('playerName')?.value) {
        this.form.patchValue({ playerName: user.displayName });
      }
    }
  }

  private loadCharacter(id: string): void {
    this.characterService.getById(id).subscribe({
      next: (character) => {
        this.form.patchValue({
          characterName: character.characterName,
          playerName: character.playerName,
          race: character.race,
          faction: character.faction ?? '',
        });
        // 解析職業字串 → 選擇器
        if (character.currentClassesString) {
          const parsed = character.currentClassesString.split('/').map(seg => {
            const match = seg.trim().match(/^(.+?)([\d]+)$/);
            if (match) return { className: match[1].trim(), level: parseInt(match[2], 10) };
            return { className: seg.trim(), level: 1 };
          }).filter(e => e.className);
          if (parsed.length > 0) this.classEntries.set(parsed);
        }
      },
      error: () => {
        this.snackBar.open('載入角色資料失敗', '關閉', { duration: 3000 });
        this.router.navigate(['/characters']);
      },
    });
  }



  protected onSubmit(): void {
    if (this.isEditMode()) {
      // 編輯模式下僅驗證基本欄位
      const basicValid =
        this.form.get('characterName')!.valid &&
        this.form.get('playerName')!.valid &&
        this.form.get('race')!.valid;
      if (!basicValid) {
        this.form.get('characterName')!.markAsTouched();
        this.form.get('playerName')!.markAsTouched();
        this.form.get('race')!.markAsTouched();
        return;
      }
    } else {
      if (this.form.invalid) {
        this.form.markAllAsTouched();
        return;
      }
    }

    this.isSaving.set(true);
    const raw = this.form.getRawValue();
    const req: CharacterRequest = {
      characterName: raw.characterName.trim(),
      playerName: raw.playerName.trim(),
      race: raw.race.trim(),
      faction: raw.faction?.trim() || null,
      currentClassesString: this.buildClassesString(),
    };

    if (this.isEditMode() && this.characterId) {
      this.characterService.update(this.characterId, req).subscribe({
        next: (updated) => {
          this.snackBar.open('角色資料已更新', '關閉', { duration: 2500 });
          this.router.navigate(['/characters', updated.id, 'adventures']);
        },
        error: () => {
          this.isSaving.set(false);
          this.snackBar.open('更新失敗，請稍後再試', '關閉', { duration: 3000 });
        },
      });
    } else {
      this.characterService.create(req).subscribe({
        next: (created) => {
          this.snackBar.open(`角色「${created.characterName}」已建立！`, '關閉', { duration: 2500 });
          this.router.navigate(['/characters', created.id, 'adventures']);
        },
        error: () => {
          this.isSaving.set(false);
          this.snackBar.open('建立失敗，請稍後再試', '關閉', { duration: 3000 });
        },
      });
    }
  }

  protected onBack(): void {
    if (this.isEditMode() && this.characterId) {
      this.router.navigate(['/characters', this.characterId, 'adventures']);
    } else {
      this.router.navigate(['/characters']);
    }
  }
}
