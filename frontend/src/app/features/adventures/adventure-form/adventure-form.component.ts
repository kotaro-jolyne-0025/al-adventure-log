import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AdventureService } from '../../../core/services/adventure.service';
import { AdventureEntryRequest, DowntimeActivity } from '../../../core/models/adventure.model';
import { from, concatMap, toArray } from 'rxjs';

@Component({
  selector: 'app-adventure-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatSlideToggleModule,
    MatTooltipModule,
  ],
  templateUrl: './adventure-form.component.html',
  styleUrl: './adventure-form.component.scss',
})
export class AdventureFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly adventureService = inject(AdventureService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly CLASS_OPTIONS = [
    '戰士', '法師', '牧師', '遊蕩者', '遊俠',
    '吟遊詩人', '德魯伊', '武僧', '聖騎士', '契術師',
    '術士', '野蠻人', '奇械師',
  ];

  protected isEditMode = signal(false);
  protected isSaving = signal(false);
  private characterId!: string;
  private entryId?: string;

  // ── 起始等級與職業 ──────────────────────────────────────────────────────────
  protected readonly _startingLevel = signal<number>(1);
  protected readonly _startingClassesString = signal<string | null>(null);

  // ── 升級機制 ──────────────────────────────────────────────────────────────
  protected levelUp = signal(false);
  protected catchup = signal(false);
  protected catchupCount = signal(1);

  // ── 職業與等級配置列表 ───────────────────────────────────────────────────────
  protected classEntries = signal<{ className: string; level: number }[]>([]);

  // 結束總等級（起始等級 + 本次升級 + 迎頭趕上）
  protected readonly endingLevel = computed(() => {
    const base = this._startingLevel();
    const up = this.levelUp() ? 1 : 0;
    const cu = this.catchup() ? Math.max(1, this.catchupCount()) : 0;
    return base + up + cu;
  });

  // 職業等級配置加總
  protected readonly classesTotalLevel = computed(() => {
    return this.classEntries().reduce((sum, e) => sum + (e.level || 0), 0);
  });

  // 是否平衡
  protected readonly isLevelBalanced = computed(() => {
    return this.classesTotalLevel() === this.endingLevel();
  });

  // ── 即時計算合計（顯示用） ──────────────────────────────────────────────────
  private readonly _startingGold = signal<number | null>(null);
  private readonly _goldChange = signal<number | null>(null);
  private readonly _goldDowntimeChange = signal<number | null>(null);
  private readonly _startingDowntime = signal<number | null>(null);
  private readonly _downtimeChange = signal<number | null>(null);
  private readonly _downtimeDowntimeChange = signal<number | null>(null);
  private readonly _startingMagicItems = signal<number | null>(null);
  private readonly _magicItemsChange = signal<number | null>(null);
  private readonly _magicItemsDowntimeChange = signal<number | null>(null);

  protected readonly goldTotal = computed(() => {
    const s = this._startingGold();
    const c = this._goldChange();
    const d = this._goldDowntimeChange();
    if (s == null && c == null && d == null) return null;
    return (s ?? 0) + (c ?? 0) + (d ?? 0);
  });
  protected readonly downtimeTotal = computed(() => {
    const s = this._startingDowntime();
    const c = this._downtimeChange();
    const d = this._downtimeDowntimeChange();
    if (s == null && c == null && d == null) return null;
    return (s ?? 0) + (c ?? 0) + (d ?? 0);
  });
  protected readonly magicItemsTotal = computed(() => {
    const s = this._startingMagicItems();
    const c = this._magicItemsChange();
    const d = this._magicItemsDowntimeChange();
    if (s == null && c == null && d == null) return null;
    return (s ?? 0) + (c ?? 0) + (d ?? 0);
  });

  // ── 休整期活動 ──────────────────────────────────────────────────────────────
  protected pendingActivities = signal<string[]>([]);
  protected existingActivities = signal<DowntimeActivity[]>([]);
  protected newActivityText = '';

  protected form: FormGroup = this.fb.group({
    adventureCode: [''],
    adventureName: [''],
    playDate: [new Date(), Validators.required],
    dmName: [''],
    startingGold: [null],
    goldChange: [null],
    goldDowntimeChange: [null],
    startingDowntime: [null],
    downtimeChange: [null],
    downtimeDowntimeChange: [null],
    startingMagicItems: [null],
    magicItemsChange: [null],
    magicItemsDowntimeChange: [null],
    adventureNotes: [''],
    soulCoinChargesUsed: [''],
  });

  ngOnInit(): void {
    this.characterId =
      this.route.parent?.snapshot.paramMap.get('id') ??
      this.route.snapshot.paramMap.get('characterId') ?? '';
    const entryIdParam = this.route.snapshot.paramMap.get('entryId');

    this.form.get('startingGold')!.valueChanges.subscribe(v => this._startingGold.set(v != null && v !== '' ? Number(v) : null));
    this.form.get('goldChange')!.valueChanges.subscribe(v => this._goldChange.set(v != null && v !== '' ? Number(v) : null));
    this.form.get('goldDowntimeChange')!.valueChanges.subscribe(v => this._goldDowntimeChange.set(v != null && v !== '' ? Number(v) : null));
    this.form.get('startingDowntime')!.valueChanges.subscribe(v => this._startingDowntime.set(v != null && v !== '' ? Number(v) : null));
    this.form.get('downtimeChange')!.valueChanges.subscribe(v => this._downtimeChange.set(v != null && v !== '' ? Number(v) : null));
    this.form.get('downtimeDowntimeChange')!.valueChanges.subscribe(v => this._downtimeDowntimeChange.set(v != null && v !== '' ? Number(v) : null));
    this.form.get('startingMagicItems')!.valueChanges.subscribe(v => this._startingMagicItems.set(v != null && v !== '' ? Number(v) : null));
    this.form.get('magicItemsChange')!.valueChanges.subscribe(v => this._magicItemsChange.set(v != null && v !== '' ? Number(v) : null));
    this.form.get('magicItemsDowntimeChange')!.valueChanges.subscribe(v => this._magicItemsDowntimeChange.set(v != null && v !== '' ? Number(v) : null));

    if (entryIdParam) {
      this.isEditMode.set(true);
      this.entryId = entryIdParam;
      this.loadEntry(this.entryId);
    } else {
      this.loadDefaults();
    }
  }

  private parseClassesString(classesString?: string | null): { className: string; level: number }[] {
    if (!classesString) return [];
    return classesString.split('/').map(seg => {
      const match = seg.trim().match(/^(.+?)(\d+)$/);
      if (match) return { className: match[1].trim(), level: parseInt(match[2], 10) };
      return { className: seg.trim(), level: 1 };
    }).filter(e => e.className);
  }

  private loadDefaults(): void {
    this.adventureService.getDefaults(this.characterId).subscribe({
      next: (d) => {
        if (d.startingLevel != null) {
          this._startingLevel.set(d.startingLevel);
        }
        if (d.startingClassesString) {
          this._startingClassesString.set(d.startingClassesString);
          const parsed = this.parseClassesString(d.startingClassesString);
          if (parsed.length > 0) {
            this.classEntries.set(parsed);
          }
        }
        this.form.patchValue({
          startingGold: d.startingGold ?? 0,
          startingDowntime: d.startingDowntime ?? 0,
          startingMagicItems: d.startingMagicItems ?? 0,
        });
      },
      error: () => { /* 靜默略過 */ },
    });
  }

  private loadEntry(id: string): void {
    this.adventureService.getById(this.characterId, id).subscribe({
      next: (entry) => {
        this._startingLevel.set(entry.startingLevel ?? 1);
        this._startingClassesString.set(entry.startingClassesString ?? null);

        const targetClasses = entry.endingClassesString || entry.startingClassesString;
        if (targetClasses) {
          const parsed = this.parseClassesString(targetClasses);
          if (parsed.length > 0) {
            this.classEntries.set(parsed);
          }
        }

        // 如果 endingLevel 大於 startingLevel，還原 toggle 狀態
        const diff = (entry.endingLevel ?? 1) - (entry.startingLevel ?? 1);
        if (diff > 0) {
          this.levelUp.set(true);
          if (diff > 1) {
            this.catchup.set(true);
            this.catchupCount.set(diff - 1);
          }
        }

        this.existingActivities.set(entry.downtimeActivities ?? []);

        this.form.patchValue({
          adventureCode: entry.adventureCode ?? '',
          adventureName: entry.adventureName ?? '',
          playDate: entry.playDate ? new Date(entry.playDate) : null,
          dmName: entry.dmName ?? '',
          startingGold: entry.startingGold ?? null,
          goldChange: entry.goldChange ?? null,
          goldDowntimeChange: entry.goldDowntimeChange ?? null,
          startingDowntime: entry.startingDowntime ?? null,
          downtimeChange: entry.downtimeChange ?? null,
          downtimeDowntimeChange: entry.downtimeDowntimeChange ?? null,
          startingMagicItems: entry.startingMagicItems ?? null,
          magicItemsChange: entry.magicItemsChange ?? null,
          magicItemsDowntimeChange: entry.magicItemsDowntimeChange ?? null,
          adventureNotes: entry.adventureNotes ?? '',
          soulCoinChargesUsed: entry.soulCoinChargesUsed ?? '',
        });
      },
      error: () => {
        this.snackBar.open('載入記錄失敗', '關閉', { duration: 3000 });
        this.onBack();
      },
    });
  }

  // ── 升級與職業操作 ──────────────────────────────────────────────────────────

  protected onLevelUpToggle(checked: boolean): void {
    this.levelUp.set(checked);
    this.autoAdjustClassLevel(checked ? 1 : -1);
  }

  protected onCatchupToggle(checked: boolean): void {
    this.catchup.set(checked);
    const count = this.catchupCount();
    this.autoAdjustClassLevel(checked ? count : -count);
  }

  protected onCatchupCountChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const oldCount = this.catchupCount();
    const newCount = Math.max(1, parseInt(input.value, 10) || 1);
    this.catchupCount.set(newCount);
    if (this.catchup()) {
      this.autoAdjustClassLevel(newCount - oldCount);
    }
  }

  private autoAdjustClassLevel(diff: number): void {
    if (diff === 0) return;
    const entries = this.classEntries();
    if (entries.length === 0) {
      this.classEntries.set([{ className: '戰士', level: Math.max(1, 1 + diff) }]);
      return;
    }
    // 預設將等級加/減在第一個職業上
    const first = entries[0];
    const newLvl = Math.max(1, first.level + diff);
    this.classEntries.update(list => list.map((e, i) => i === 0 ? { ...e, level: newLvl } : e));
  }

  protected addClass(): void {
    this.classEntries.update(list => [...list, { className: '', level: 1 }]);
  }

  protected removeClass(index: number): void {
    this.classEntries.update(list => list.filter((_, i) => i !== index));
  }

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

  private buildEndingClassesString(): string | null {
    const filled = this.classEntries().filter(e => e.className.trim());
    if (filled.length === 0) return null;
    return filled.map(e => `${e.className.trim()}${e.level}`).join('/');
  }

  // ── 休整期活動操作 ──────────────────────────────────────────────────────────

  protected addActivity(): void {
    const text = this.newActivityText.trim();
    if (!text) return;
    this.newActivityText = '';

    if (this.isEditMode() && this.entryId) {
      this.adventureService.addDowntime(this.entryId, { description: text }).subscribe({
        next: (created) => {
          this.existingActivities.update(list => [...list, created]);
        },
        error: () => {
          this.snackBar.open('新增活動失敗', '關閉', { duration: 3000 });
        },
      });
    } else {
      this.pendingActivities.update(list => [...list, text]);
    }
  }

  protected removeActivity(index: number): void {
    if (this.isEditMode() && this.entryId) {
      const activity = this.existingActivities()[index];
      this.adventureService.deleteDowntime(this.entryId, activity.id).subscribe({
        next: () => {
          this.existingActivities.update(list => list.filter((_, i) => i !== index));
        },
        error: () => {
          this.snackBar.open('刪除活動失敗', '關閉', { duration: 3000 });
        },
      });
    } else {
      this.pendingActivities.update(list => list.filter((_, i) => i !== index));
    }
  }

  private buildRequest(): AdventureEntryRequest {
    const raw = this.form.getRawValue();
    const toNum = (v: unknown): number | null =>
      v !== '' && v !== null && v !== undefined ? Number(v) : null;
    const toDateStr = (val: Date | null): string | null => {
      if (!val) return null;
      const d = val instanceof Date ? val : new Date(val);
      return d.toISOString().split('T')[0];
    };
    return {
      adventureCode: raw.adventureCode?.trim() || null,
      adventureName: raw.adventureName?.trim() || null,
      playDate: toDateStr(raw.playDate),
      dmName: raw.dmName?.trim() || null,
      startingLevel: this._startingLevel(),
      endingLevel: this.endingLevel(),
      startingGold: toNum(raw.startingGold),
      goldChange: toNum(raw.goldChange),
      goldDowntimeChange: toNum(raw.goldDowntimeChange),
      startingDowntime: toNum(raw.startingDowntime),
      downtimeChange: toNum(raw.downtimeChange),
      downtimeDowntimeChange: toNum(raw.downtimeDowntimeChange),
      startingMagicItems: toNum(raw.startingMagicItems),
      magicItemsChange: toNum(raw.magicItemsChange),
      magicItemsDowntimeChange: toNum(raw.magicItemsDowntimeChange),
      adventureNotes: raw.adventureNotes?.trim() || null,
      soulCoinChargesUsed: raw.soulCoinChargesUsed?.trim() || null,
      endingClassesString: this.buildEndingClassesString(),
    };
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snackBar.open('請填寫必填欄位（遊玩日期）', '關閉', { duration: 3000 });
      return;
    }
    if (!this.isLevelBalanced()) {
      this.snackBar.open('職業等級加總與結束等級不符，請調整後再儲存', '關閉', { duration: 3000 });
      return;
    }

    this.isSaving.set(true);
    const req = this.buildRequest();

    if (this.isEditMode() && this.entryId) {
      this.adventureService.update(this.characterId, this.entryId, req).subscribe({
        next: (updated) => {
          this.snackBar.open('記錄已更新', '關閉', { duration: 2500 });
          this.router.navigate(['/characters', this.characterId, 'adventures', updated.id]);
        },
        error: () => {
          this.isSaving.set(false);
          this.snackBar.open('更新失敗，請稍後再試', '關閉', { duration: 3000 });
        },
      });
    } else {
      this.adventureService.create(this.characterId, req).subscribe({
        next: (created) => {
          const pending = this.pendingActivities();
          if (pending.length === 0) {
            this.snackBar.open('冒險記錄已新增', '關閉', { duration: 2500 });
            this.router.navigate(['/characters', this.characterId, 'adventures', created.id]);
            return;
          }
          from(pending).pipe(
            concatMap(desc => this.adventureService.addDowntime(created.id, { description: desc })),
            toArray(),
          ).subscribe({
            next: () => {
              this.snackBar.open('冒險記錄已新增', '關閉', { duration: 2500 });
              this.router.navigate(['/characters', this.characterId, 'adventures', created.id]);
            },
            error: () => {
              this.snackBar.open('冒險記錄已新增（部分活動儲存失敗）', '關閉', { duration: 3500 });
              this.router.navigate(['/characters', this.characterId, 'adventures', created.id]);
            },
          });
        },
        error: () => {
          this.isSaving.set(false);
          this.snackBar.open('新增失敗，請稍後再試', '關閉', { duration: 3000 });
        },
      });
    }
  }

  protected onBack(): void {
    if (this.isEditMode() && this.entryId) {
      this.router.navigate(['/characters', this.characterId, 'adventures', this.entryId]);
    } else {
      this.router.navigate(['/characters', this.characterId, 'adventures']);
    }
  }
}
