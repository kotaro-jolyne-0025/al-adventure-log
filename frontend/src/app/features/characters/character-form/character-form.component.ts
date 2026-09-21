import { Component, computed, inject, OnInit, signal } from '@angular/core';

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

import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';
import { CharacterService } from '../../../core/services/character.service';
import { DND_CLASSES, formatClassLevels, parseClassLevels } from '../../../core/models/dnd-classes';
import { Character, CharacterRequest } from '../../../core/models/character.model';
import { AuthService } from '../../../core/services/auth.service';
import { AvatarCropperDialogComponent } from '../avatar-cropper-dialog/avatar-cropper-dialog.component';
import {
  LucideArrowLeft,
  LucideImagePlus,
  LucideRefreshCw,
  LucideUpload,
  LucideTrash2,
  LucidePlus,
  LucideSave,
} from '@lucide/angular';

@Component({
  selector: 'app-character-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatProgressSpinner,
    MatTooltipModule,
    LucideArrowLeft,
    LucideImagePlus,
    LucideRefreshCw,
    LucideUpload,
    LucideTrash2,
    LucidePlus,
    LucideSave,
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
  private readonly dialog = inject(MatDialog);

  protected readonly CLASS_OPTIONS = DND_CLASSES;

  protected isEditMode = signal(false);
  protected isSaving = signal(false);
  protected avatarUrl = signal<string | null>(null);
  protected hasAdventureEntries = signal(false);
  private loadedCharacter: Character | null = null;
  private characterId: string | null = null;

  protected form: FormGroup = this.fb.group({
    characterName: ['', Validators.required],
    race: ['', Validators.required],
    subclass: [''],
    faction: [''],
    soulCoins: [0, [Validators.min(0), Validators.pattern('^[0-9]*$')]],
    initialGold: [0, [Validators.min(0), Validators.pattern('^\\d+(\\.\\d{1,2})?$')]],
    initialDowntime: [0, [Validators.min(0), Validators.pattern('^[0-9]*$')]],
  });

  // 職業等級選擇器
  protected classEntries = signal<{ className: string; level: number }[]>([
    { className: '', level: 1 },
  ]);

  protected addClass(): void {
    this.classEntries.update((list) => [...list, { className: '', level: 1 }]);
  }

  protected removeClass(index: number): void {
    this.classEntries.update((list) => list.filter((_, i) => i !== index));
  }

  protected totalLevel = computed(() =>
    this.classEntries().reduce((sum, e) => sum + (e.level || 0), 0),
  );

  protected updateClassName(index: number, value: string): void {
    this.classEntries.update((list) =>
      list.map((e, i) => (i === index ? { ...e, className: value } : e)),
    );
  }

  protected updateClassLevel(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const num = parseInt(input.value, 10);
    if (isNaN(num) || num < 1) return;
    this.classEntries.update((list) =>
      list.map((e, i) => (i === index ? { ...e, level: num } : e)),
    );
  }

  private buildClassesString(): string | null {
    const filled = this.classEntries().filter((e) => e.className.trim());
    if (filled.length === 0) return null;
    return filled.map((e) => `${e.className.trim()}${e.level}`).join('/');
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id && id !== 'new') {
      this.isEditMode.set(true);
      this.characterId = id;
      this.loadCharacter(this.characterId);
    }
  }

  private loadCharacter(id: string): void {
    this.characterService.getById(id).subscribe({
      next: (character) => {
        this.form.patchValue({
          characterName: character.characterName,
          race: character.race,
          subclass: character.subclass ?? '',
          faction: character.faction ?? '',
          soulCoins: character.soulCoins ?? 0,
        });
        this.avatarUrl.set(character.avatarUrl ?? null);
        this.loadedCharacter = character;
        this.hasAdventureEntries.set(character.hasAdventureEntries ?? false);
        this.form.patchValue({
          initialGold: character.initialGold ?? 0,
          initialDowntime: character.initialDowntime ?? 0,
        });
        // 解析職業字串 → 選擇器
        const openingClasses = character.initialClassesString || character.currentClassesString;
        if (openingClasses) {
          const parsed = parseClassLevels(openingClasses);
          if (parsed.length > 0) this.classEntries.set(parsed);
        }
      },
      error: () => {
        this.snackBar.open('載入角色資料失敗', '關閉', { duration: 3000 });
        this.router.navigate(['/characters']);
      },
    });
  }

  protected onAvatarFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      // 驗證是否為圖片
      if (!file.type.startsWith('image/')) {
        this.snackBar.open('請選取有效的圖片檔案', '關閉', { duration: 2500 });
        input.value = '';
        return;
      }
      // 限制原始檔案大小（5MB），避免大圖解碼佔用過多記憶體導致裁切卡頓
      const MAX_FILE_SIZE = 5 * 1024 * 1024;
      if (file.size > MAX_FILE_SIZE) {
        this.snackBar.open('圖片檔案過大，請選擇 5MB 以下的圖片', '關閉', { duration: 3000 });
        input.value = '';
        return;
      }
      this.openCropper(file);
      input.value = ''; // 重置 input 讓同檔名可重複觸發
    }
  }

  private openCropper(source: string | File): void {
    const dialogRef = this.dialog.open(AvatarCropperDialogComponent, {
      data: { imageSource: source },
      width: '400px',
      maxWidth: '92vw',
      disableClose: true,
    });

    dialogRef.afterClosed().subscribe((croppedDataUrl: string | undefined) => {
      if (croppedDataUrl) {
        this.avatarUrl.set(croppedDataUrl);
      }
    });
  }

  protected removeAvatar(): void {
    this.avatarUrl.set(null);
  }

  protected onSubmit(): void {
    if (this.isEditMode()) {
      // 編輯模式下僅驗證基本欄位
      const basicValid = this.form.get('characterName')!.valid && this.form.get('race')!.valid
        && this.form.get('initialGold')!.valid && this.form.get('initialDowntime')!.valid
        && this.totalLevel() >= 1 && this.totalLevel() <= 20
        && this.classEntries().every(entry => !!entry.className.trim());
      if (!basicValid) {
        this.form.markAllAsTouched();
        return;
      }
    } else {
      if (this.form.invalid || this.totalLevel() < 1 || this.totalLevel() > 20
        || this.classEntries().some(entry => !entry.className.trim())) {
        this.form.markAllAsTouched();
        this.snackBar.open('請完成至少一筆有效的開卡職業與等級（總等級 1 至 20）', '關閉', { duration: 3000 });
        return;
      }
    }

    this.isSaving.set(true);
    const raw = this.form.getRawValue();
    const req: CharacterRequest = {
      characterName: raw.characterName.trim(),
      race: raw.race.trim(),
      subclass: raw.subclass?.trim() || null,
      faction: raw.faction?.trim() || null,
      avatarUrl: this.avatarUrl(),
      currentClassesString: this.buildClassesString(),
      initialClassesString: this.buildClassesString(),
      initialGold: raw.initialGold ?? 0,
      initialDowntime: raw.initialDowntime ?? 0,
      soulCoins: raw.soulCoins ?? 0,
    };

    if (this.isEditMode() && this.characterId) {
      const baselineChanged = this.loadedCharacter != null && (
        req.initialClassesString !== (this.loadedCharacter.initialClassesString ?? this.loadedCharacter.currentClassesString ?? null)
        || Number(req.initialGold) !== Number(this.loadedCharacter.initialGold ?? 0)
        || Number(req.initialDowntime) !== Number(this.loadedCharacter.initialDowntime ?? 0)
      );
      if (this.hasAdventureEntries() && baselineChanged) {
        this.characterService.previewOpeningBaseline(this.characterId, req).subscribe({
          next: preview => {
            const current = this.loadedCharacter!;
            const message = [
              '修正開卡資料後，角色目前狀態將重新計算：',
              `職業：${formatClassLevels(current.currentClassesString) || '無'} → ${formatClassLevels(preview.currentClassesString) || '無'}`,
              `金幣：${current.currentGold ?? 0} → ${preview.currentGold}`,
              `休整期：${current.currentDowntime ?? 0} 天 → ${preview.currentDowntime} 天`,
              '',
              '既有冒險快照不會改動；後續冒險仍依日期前的快照帶入起始值。若舊快照不正確，請另行逐筆修正該冒險。倉庫物品不會改動。',
              '',
              '要儲存這項修正嗎？',
            ].join('\n');
            if (window.confirm(message)) this.saveCharacter(req);
            else this.isSaving.set(false);
          },
          error: () => {
            this.isSaving.set(false);
            this.snackBar.open('無法預覽修正結果，資料尚未儲存', '關閉', { duration: 3000 });
          },
        });
      } else {
        this.saveCharacter(req);
      }
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

  private saveCharacter(req: CharacterRequest): void {
    if (this.characterId) this.characterService.update(this.characterId, req).subscribe({
        next: (updated) => {
          this.snackBar.open(this.hasAdventureEntries()
            ? '角色與開卡基準已更新；冒險快照維持不變' : '角色資料已更新', '關閉', { duration: 3000 });
          this.router.navigate(['/characters', updated.id, 'adventures']);
        },
        error: () => {
          this.isSaving.set(false);
          this.snackBar.open('更新失敗，請稍後再試', '關閉', { duration: 3000 });
        },
      });
  }

  protected onBack(): void {
    if (this.isEditMode() && this.characterId) {
      this.router.navigate(['/characters', this.characterId, 'adventures']);
    } else {
      this.router.navigate(['/characters']);
    }
  }
}
