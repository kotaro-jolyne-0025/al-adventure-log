import { CommonModule, DecimalPipe } from '@angular/common';
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
import { TextFieldModule } from '@angular/cdk/text-field';
import { AdventureService } from '../../../core/services/adventure.service';
import { InventoryService } from '../../../core/services/inventory.service';
import { AdventureEntry, AdventureEntryRequest, AdventureGainedItemRequest } from '../../../core/models/adventure.model';
import { ItemRarity, ITEM_RARITY_LABELS, InventoryItemRequest } from '../../../core/models/inventory.model';
import { from, of, concatMap, toArray, map, Observable, catchError, forkJoin } from 'rxjs';

import {
  LucideCoins,
  LucideTent,
  LucideSparkles,
  LucideFlaskConical,
  LucideScrollText,
  LucideSwords,
  LucideCalculator,
} from '@lucide/angular';

export interface DowntimeActivityItem {
  id?: string;
  presetLabel?: string;
  description: string;
  gold: number | null;
  downtime: number | null;
  magicItems: number | null;
}

@Component({
  selector: 'app-adventure-form',
  standalone: true,
  imports: [
    CommonModule,
    DecimalPipe,
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
    TextFieldModule,
    LucideCoins,
    LucideTent,
    LucideSparkles,
    LucideFlaskConical,
    LucideScrollText,
    LucideSwords,
    LucideCalculator,
  ],
  templateUrl: './adventure-form.component.html',
  styleUrl: './adventure-form.component.scss',
})
export class AdventureFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly adventureService = inject(AdventureService);
  private readonly inventoryService = inject(InventoryService);
  private readonly snackBar = inject(MatSnackBar);

  protected isEditMode = signal(false);
  protected isSaving = signal(false);
  protected characterId!: string;
  protected entryId: string | null = null;

  // ── 5e 職業選項 ─────────────────────────────────────────────────────────────
  readonly CLASS_OPTIONS: string[] = [
    '野蠻人 (Barbarian)',
    '吟遊詩人 (Bard)',
    '牧師 (Cleric)',
    '德魯伊 (Druid)',
    '戰士 (Fighter)',
    '武僧 (Monk)',
    '聖騎士 (Paladin)',
    '遊俠 (Ranger)',
    '遊蕩者 (Rogue)',
    '術士 (Sorcerer)',
    '契術師 (Warlock)',
    '法師 (Wizard)',
    '奇術師 (Artificer)',
  ];

  // ── 等級與升級機制 Signals ──────────────────────────────────────────────────
  protected readonly _startingLevel = signal<number>(1);
  protected readonly _startingClassesString = signal<string | null>(null);

  protected levelUp = signal(false);
  protected catchup = signal(false);
  protected catchupCount = signal(1);

  // 結束等級（純衍生）
  protected readonly endingLevel = computed(() => {
    let lvl = this._startingLevel();
    if (this.levelUp()) lvl += 1;
    if (this.catchup()) lvl += this.catchupCount();
    return Math.min(20, Math.max(1, lvl));
  });

  // 結束職業與等級配置列表
  protected classEntries = signal<{ className: string; level: number }[]>([
    { className: '戰士 (Fighter)', level: 1 },
  ]);

  protected readonly classesTotalLevel = computed(() =>
    this.classEntries().reduce((sum, e) => sum + (e.level || 0), 0)
  );

  protected readonly isLevelBalanced = computed(() =>
    this.classesTotalLevel() === this.endingLevel()
  );

  // ── 資源計算 Signals ────────────────────────────────────────────────────────
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
    return Math.round(((s ?? 0) + (c ?? 0) + (d ?? 0)) * 100) / 100;
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

  // 資源非負值校驗（起始值與合計皆不得為負數）
  protected readonly isResourceValid = computed(() => {
    const sg = this._startingGold();
    const sd = this._startingDowntime();
    const sm = this._startingMagicItems();
    if (sg !== null && sg < 0) return false;
    if (sd !== null && sd < 0) return false;
    if (sm !== null && sm < 0) return false;

    const gt = this.goldTotal();
    const dt = this.downtimeTotal();
    const mt = this.magicItemsTotal();
    if (gt !== null && gt < 0) return false;
    if (dt !== null && dt < 0) return false;
    if (mt !== null && mt < 0) return false;
    return true;
  });

  // ── 休整期活動快捷預設定義 ──────────────────────────────────────────────────
  protected readonly DOWNTIME_PRESETS = [
    { label: '迎頭趕上（升等）', name: '迎頭趕上', downtime: -10, gold: null, magicItems: null },
    { label: '魔法物品交易', name: '魔法物品交易', downtime: -5, gold: null, magicItems: null },
    { label: '抄寫法術（0~4 環）', name: '抄寫法術', downtime: -1, gold: -50, magicItems: null },
    { label: '抄寫高階法術（5 環以上）', name: '抄寫高階法術', downtime: -2, gold: -250, magicItems: null },
    { label: '釀造治療藥水', name: '釀造治療藥水', downtime: -5, gold: -25, magicItems: null },
    { label: '製作法術卷軸', name: '製作法術卷軸', downtime: -5, gold: -25, magicItems: null },
    { label: '交換傳送法陣座標', name: '交換傳送法陣座標', downtime: -10, gold: null, magicItems: null },
    { label: '學習語言或工具', name: '學習語言或工具', downtime: -10, gold: -10, magicItems: null },
  ];

  // ── 本次獲得的永久性魔法物品清單 ──────────────────────────────────────────
  readonly rarities: (ItemRarity | '')[] = ['', 'COMMON', 'UNCOMMON', 'RARE', 'VERY_RARE', 'LEGENDARY', 'ARTIFACT'];
  readonly rarityLabels = ITEM_RARITY_LABELS;

  protected gainedMagicItems = signal<{
    id?: string;
    itemName: string;
    rarity: ItemRarity | '';
    notes: string;
  }[]>([]);

  protected gainedConsumableItems = signal<{
    id?: string;
    itemName: string;
    quantity: number;
    rarity: ItemRarity | '';
    notes: string;
  }[]>([]);

  private deletedItemIds: string[] = [];

  // ── 休整期活動卡片清單 ────────────────────────────────────────────────────
  protected downtimeActivities = signal<DowntimeActivityItem[]>([]);
  private deletedActivityIds: string[] = [];

  protected form: FormGroup = this.fb.group({
    adventureCode: [''],
    adventureName: [''],
    playDate: [new Date(), Validators.required],
    dmName: [''],
    startingGold: [null, [Validators.min(0)]],
    goldChange: [null],
    goldDowntimeChange: [null],
    startingDowntime: [null, [Validators.min(0)]],
    downtimeChange: [null],
    downtimeDowntimeChange: [null],
    startingMagicItems: [null, [Validators.min(0)]],
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

  private parseLocalDate(dateStr?: string | null): Date | null {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return new Date(year, month, day);
    }
    return new Date(dateStr);
  }

  private loadDefaults(): void {
    forkJoin({
      d: this.adventureService.getDefaults(this.characterId),
      inventory: this.inventoryService.getAllByCharacter(this.characterId).pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ d, inventory }) => {
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
        const warehouseMagicCount = (inventory ?? [])
          .filter((i) => i.itemType === 'PERMANENT')
          .reduce((sum, i) => sum + (i.quantity || 1), 0);

        this.form.patchValue({
          startingGold: d.startingGold ?? 0,
          startingDowntime: d.startingDowntime ?? 0,
          startingMagicItems: warehouseMagicCount,
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

        // 解析已儲存的休整期活動
        const items: DowntimeActivityItem[] = (entry.downtimeActivities ?? []).map(act => {
          const regex = /^(.*?)(?:\s*\((.*?)\))?$/;
          const match = act.description.match(regex);
          const mainDesc = match ? match[1].trim() : act.description;
          const deltasStr = match && match[2] ? match[2] : '';

          let gold: number | null = null;
          let downtime: number | null = null;
          let magicItems: number | null = null;

          if (deltasStr) {
            const goldMatch = deltasStr.match(/金幣\s*([+-]?\d+(?:\.\d+)?)\s*gp/i);
            if (goldMatch) gold = parseFloat(goldMatch[1]);
            const dtMatch = deltasStr.match(/休整期\s*([+-]?\d+)\s*天/i);
            if (dtMatch) downtime = parseInt(dtMatch[1], 10);
            const magicMatch = deltasStr.match(/魔法物品\s*([+-]?\d+)\s*件/i);
            if (magicMatch) magicItems = parseInt(magicMatch[1], 10);
          }

          const matchedPreset = this.DOWNTIME_PRESETS.find(p => p.name === mainDesc || p.label.startsWith(mainDesc));

          return {
            id: act.id,
            presetLabel: matchedPreset?.label ?? '',
            description: mainDesc,
            gold,
            downtime,
            magicItems,
          };
        });
        this.downtimeActivities.set(items);

        this.form.patchValue({
          adventureCode: entry.adventureCode ?? '',
          adventureName: entry.adventureName ?? '',
          playDate: this.parseLocalDate(entry.playDate),
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

        this.loadGainedItems(entry);
      },
      error: () => {
        this.snackBar.open('載入記錄失敗', '關閉', { duration: 3000 });
      },
    });
  }

  private isSourceMatch(
    itemSource: string | null | undefined,
    advName?: string | null,
    advCode?: string | null
  ): boolean {
    if (!itemSource) return false;
    const s = itemSource.trim().toLowerCase();
    const name = advName?.trim().toLowerCase();
    const code = advCode?.trim().toLowerCase();

    if (!name && !code) {
      return s === '冒險獲得';
    }

    const matchText = (sourceText: string, target: string): boolean => {
      if (target.length < 2) return sourceText === target;
      return sourceText.includes(target) || target.includes(sourceText);
    };

    return !!(
      (name && matchText(s, name)) ||
      (code && matchText(s, code))
    );
  }

  private loadGainedItems(entry: AdventureEntry): void {
    if (!entry.id) return;
    this.adventureService.getGainedItems(entry.id).subscribe({
      next: (items) => {
        if (items && items.length > 0) {
          const magic = items
            .filter(item => item.itemType === 'PERMANENT')
            .map(item => ({
              id: item.id,
              itemName: item.itemName,
              rarity: (item.rarity ?? '') as ItemRarity | '',
              notes: item.notes ?? '',
            }));
          const consumables = items
            .filter(item => item.itemType === 'CONSUMABLE')
            .map(item => ({
              id: item.id,
              itemName: item.itemName,
              quantity: item.quantity ?? 1,
              rarity: (item.rarity ?? '') as ItemRarity | '',
              notes: item.notes ?? '',
            }));
          this.gainedMagicItems.set(magic);
          this.gainedConsumableItems.set(consumables);
        } else {
          this.fallbackLoadFromWarehouse(entry);
        }
      },
      error: () => {
        this.fallbackLoadFromWarehouse(entry);
      },
    });
  }

  private fallbackLoadFromWarehouse(entry: AdventureEntry): void {
    this.inventoryService.getAllByCharacter(this.characterId).subscribe({
      next: (items) => {
        const magic = items
          .filter(item => item.itemType === 'PERMANENT' && (item.adventureEntryId === entry.id || this.isSourceMatch(item.source, entry.adventureName, entry.adventureCode)))
          .map(item => ({
            id: item.id,
            itemName: item.itemName,
            rarity: item.rarity ?? ('' as ItemRarity | ''),
            notes: item.notes ?? '',
          }));
        const consumables = items
          .filter(item => item.itemType === 'CONSUMABLE' && (item.adventureEntryId === entry.id || this.isSourceMatch(item.source, entry.adventureName, entry.adventureCode)))
          .map(item => ({
            id: item.id,
            itemName: item.itemName,
            quantity: item.quantity ?? 1,
            rarity: item.rarity ?? ('' as ItemRarity | ''),
            notes: item.notes ?? '',
          }));
        this.gainedMagicItems.set(magic);
        this.gainedConsumableItems.set(consumables);
      },
      error: () => { /* 靜默略過 */ },
    });
  }

  // ── 升級與兼職操作 ──────────────────────────────────────────────────────────
  protected onLevelUpToggle(checked: boolean): void {
    this.levelUp.set(checked);
    this.autoAdjustClassLevels();
  }

  protected onCatchupToggle(checked: boolean): void {
    this.catchup.set(checked);
    this.autoAdjustClassLevels();
  }

  protected onCatchupCountChange(event: Event): void {
    const val = parseInt((event.target as HTMLInputElement).value, 10);
    this.catchupCount.set(isNaN(val) ? 1 : Math.max(1, Math.min(19, val)));
    this.autoAdjustClassLevels();
  }

  private autoAdjustClassLevels(): void {
    const target = this.endingLevel();
    const entries = this.classEntries();
    if (entries.length === 1) {
      this.classEntries.set([{ ...entries[0], level: target }]);
    }
  }

  protected addClass(): void {
    this.classEntries.update(entries => [
      ...entries,
      { className: '法師 (Wizard)', level: 1 },
    ]);
  }

  protected removeClass(index: number): void {
    this.classEntries.update(entries => entries.filter((_, i) => i !== index));
  }

  protected updateClassName(index: number, name: string): void {
    this.classEntries.update(entries =>
      entries.map((e, i) => i === index ? { ...e, className: name } : e)
    );
  }

  protected updateClassLevel(index: number, event: Event): void {
    const val = parseInt((event.target as HTMLInputElement).value, 10);
    const lvl = isNaN(val) ? 1 : Math.max(1, Math.min(20, val));
    this.classEntries.update(entries =>
      entries.map((e, i) => i === index ? { ...e, level: lvl } : e)
    );
  }

  private buildEndingClassesString(): string {
    const filled = this.classEntries().filter(e => e.className && e.level > 0);
    if (filled.length === 0) return '';
    return filled.map(e => `${e.className.trim()}${e.level}`).join('/');
  }

  // ── 休整期活動操作（卡片清單模式）─────────────────────────────────────────

  protected addDowntimeActivity(): void {
    this.downtimeActivities.update(list => [
      ...list,
      {
        description: '',
        presetLabel: '',
        gold: null,
        downtime: null,
        magicItems: null,
      },
    ]);
  }

  protected removeDowntimeActivity(index: number): void {
    const item = this.downtimeActivities()[index];
    if (item?.id) {
      this.deletedActivityIds.push(item.id);
    }
    this.downtimeActivities.update(list => list.filter((_, i) => i !== index));
    this.recalculateDowntimeTotals();
  }

  protected onActivityPresetSelect(index: number, presetLabel: string): void {
    const preset = this.DOWNTIME_PRESETS.find(p => p.label === presetLabel);
    this.downtimeActivities.update(list =>
      list.map((item, i) => {
        if (i !== index) return item;
        return {
          ...item,
          presetLabel,
          description: preset?.name ?? item.description,
          gold: preset ? (preset.gold ?? null) : item.gold,
          downtime: preset ? (preset.downtime ?? null) : item.downtime,
          magicItems: preset ? (preset.magicItems ?? null) : item.magicItems,
        };
      })
    );
    this.recalculateDowntimeTotals();
  }

  protected updateActivityDescription(index: number, desc: string): void {
    this.downtimeActivities.update(list =>
      list.map((item, i) => i === index ? { ...item, description: desc } : item)
    );
  }

  protected updateActivityGold(index: number, val: unknown): void {
    const num = val !== '' && val !== null && val !== undefined && !isNaN(Number(val)) ? Number(val) : null;
    this.downtimeActivities.update(list =>
      list.map((item, i) => i === index ? { ...item, gold: num } : item)
    );
    this.recalculateDowntimeTotals();
  }

  protected updateActivityDowntime(index: number, val: unknown): void {
    const num = val !== '' && val !== null && val !== undefined && !isNaN(Number(val)) ? parseInt(String(val), 10) : null;
    this.downtimeActivities.update(list =>
      list.map((item, i) => i === index ? { ...item, downtime: num } : item)
    );
    this.recalculateDowntimeTotals();
  }

  protected updateActivityMagicItems(index: number, val: unknown): void {
    const num = val !== '' && val !== null && val !== undefined && !isNaN(Number(val)) ? parseInt(String(val), 10) : null;
    this.downtimeActivities.update(list =>
      list.map((item, i) => i === index ? { ...item, magicItems: num } : item)
    );
    this.recalculateDowntimeTotals();
  }

  private recalculateDowntimeTotals(): void {
    const list = this.downtimeActivities();
    let totalGold = 0;
    let totalDowntime = 0;
    let totalMagicItems = 0;
    let hasGold = false;
    let hasDowntime = false;
    let hasMagicItems = false;

    for (const item of list) {
      if (item.gold != null && !isNaN(item.gold)) {
        totalGold += item.gold;
        hasGold = true;
      }
      if (item.downtime != null && !isNaN(item.downtime)) {
        totalDowntime += item.downtime;
        hasDowntime = true;
      }
      if (item.magicItems != null && !isNaN(item.magicItems)) {
        totalMagicItems += item.magicItems;
        hasMagicItems = true;
      }
    }

    this.form.patchValue({
      goldDowntimeChange: hasGold ? Math.round(totalGold * 100) / 100 : (list.length > 0 ? 0 : null),
      downtimeDowntimeChange: hasDowntime ? totalDowntime : (list.length > 0 ? 0 : null),
      magicItemsDowntimeChange: hasMagicItems ? totalMagicItems : (list.length > 0 ? 0 : null),
    });
  }

  private formatActivityFullDescription(item: DowntimeActivityItem): string {
    const text = item.description.trim() || '休整期活動';
    const deltas: string[] = [];
    if (item.gold != null && !isNaN(item.gold) && item.gold !== 0) {
      deltas.push(`金幣 ${item.gold > 0 ? '+' : ''}${item.gold} gp`);
    }
    if (item.downtime != null && !isNaN(item.downtime) && item.downtime !== 0) {
      deltas.push(`休整期 ${item.downtime > 0 ? '+' : ''}${item.downtime} 天`);
    }
    if (item.magicItems != null && !isNaN(item.magicItems) && item.magicItems !== 0) {
      deltas.push(`魔法物品 ${item.magicItems > 0 ? '+' : ''}${item.magicItems} 件`);
    }
    return deltas.length > 0 ? `${text} (${deltas.join(', ')})` : text;
  }

  private syncDowntimeActivities(entryId: string): Observable<unknown> {
    const deleteOps$ = this.deletedActivityIds.map(actId =>
      this.adventureService.deleteDowntime(entryId, actId)
    );

    const updateOps$ = this.downtimeActivities()
      .filter(item => !!item.id)
      .map(item => {
        const fullDesc = this.formatActivityFullDescription(item);
        return this.adventureService.updateDowntime(item.id!, { description: fullDesc });
      });

    const createOps$ = this.downtimeActivities()
      .filter(item => !item.id)
      .map(item => {
        const fullDesc = this.formatActivityFullDescription(item);
        return this.adventureService.addDowntime(entryId, { description: fullDesc });
      });

    const allOps = [...deleteOps$, ...updateOps$, ...createOps$];
    if (allOps.length === 0) return of(null);

    return from(allOps).pipe(
      concatMap(op$ => op$),
      toArray(),
    );
  }

  // ── 獲得永久性魔法物品清單操作 ──────────────────────────────────────────
  protected addGainedItem(): void {
    this.gainedMagicItems.update(list => [
      ...list,
      { itemName: '', rarity: '', notes: '' },
    ]);
    const current = Number(this.form.get('magicItemsChange')?.value) || 0;
    this.form.patchValue({ magicItemsChange: current + 1 });
  }

  protected removeGainedItem(index: number): void {
    const item = this.gainedMagicItems()[index];
    if (item?.id) {
      this.deletedItemIds.push(item.id);
    }
    this.gainedMagicItems.update(list => list.filter((_, i) => i !== index));
    const current = Number(this.form.get('magicItemsChange')?.value) || 0;
    this.form.patchValue({ magicItemsChange: Math.max(0, current - 1) });
  }

  protected updateGainedItemName(index: number, name: string): void {
    this.gainedMagicItems.update(list =>
      list.map((item, i) => i === index ? { ...item, itemName: name } : item)
    );
  }

  protected updateGainedItemRarity(index: number, rarity: ItemRarity | ''): void {
    this.gainedMagicItems.update(list =>
      list.map((item, i) => i === index ? { ...item, rarity } : item)
    );
  }

  protected updateGainedItemNotes(index: number, notes: string): void {
    this.gainedMagicItems.update(list =>
      list.map((item, i) => i === index ? { ...item, notes } : item)
    );
  }

  // ── 獲得消耗品清單操作 ──────────────────────────────────────────
  protected addGainedConsumableItem(): void {
    this.gainedConsumableItems.update(list => [
      ...list,
      { itemName: '', quantity: 1, rarity: '', notes: '' },
    ]);
  }

  protected removeGainedConsumableItem(index: number): void {
    const item = this.gainedConsumableItems()[index];
    if (item?.id) {
      this.deletedItemIds.push(item.id);
    }
    this.gainedConsumableItems.update(list => list.filter((_, i) => i !== index));
  }

  protected updateGainedConsumableItemName(index: number, name: string): void {
    this.gainedConsumableItems.update(list =>
      list.map((item, i) => i === index ? { ...item, itemName: name } : item)
    );
  }

  protected updateGainedConsumableItemQuantity(index: number, qty: unknown): void {
    const num = Math.max(1, parseInt(String(qty), 10) || 1);
    this.gainedConsumableItems.update(list =>
      list.map((item, i) => i === index ? { ...item, quantity: num } : item)
    );
  }

  protected updateGainedConsumableItemRarity(index: number, rarity: ItemRarity | ''): void {
    this.gainedConsumableItems.update(list =>
      list.map((item, i) => i === index ? { ...item, rarity } : item)
    );
  }

  protected updateGainedConsumableItemNotes(index: number, notes: string): void {
    this.gainedConsumableItems.update(list =>
      list.map((item, i) => i === index ? { ...item, notes } : item)
    );
  }

  // ── 同步獲得物品至快照表與倉庫（方案 A：增量同步 Delta Sync）─────────────
  private syncGainedItemsToInventory(sourceAdventureName: string, entryId: string): Observable<unknown> {
    // 1. 刪除操作 (刪除快照並連帶清理倉庫背包)
    const deleteOps$ = this.deletedItemIds.map(id =>
      this.adventureService.deleteGainedItem(id).pipe(
        catchError(() => of(null))
      )
    );

    // 2. 魔法物品更新 (已入庫項目)
    const magicUpdateOps$ = this.gainedMagicItems()
      .filter(item => !!item.id)
      .map(item => {
        const snapshotReq: AdventureGainedItemRequest = {
          itemName: item.itemName.trim() || '未命名魔法物品',
          itemType: 'PERMANENT',
          rarity: item.rarity || null,
          notes: item.notes.trim() || null,
        };
        return this.adventureService.updateGainedItem(entryId, item.id!, snapshotReq);
      });

    // 3. 魔法物品新增 (尚未入庫項目)
    const magicCreateOps$ = this.gainedMagicItems()
      .filter(item => !item.id)
      .map(item => {
        const snapshotReq: AdventureGainedItemRequest = {
          itemName: item.itemName.trim() || '未命名魔法物品',
          itemType: 'PERMANENT',
          rarity: item.rarity || null,
          notes: item.notes.trim() || null,
        };
        return this.adventureService.addGainedItem(entryId, snapshotReq).pipe(
          concatMap(createdGained => {
            const warehouseReq: InventoryItemRequest = {
              adventureEntryId: entryId,
              adventureGainedItemId: createdGained.id,
              itemType: 'PERMANENT',
              itemName: item.itemName.trim() || '未命名魔法物品',
              rarity: item.rarity || null,
              source: sourceAdventureName,
              notes: item.notes.trim() || null,
            };
            return this.inventoryService.create(this.characterId, warehouseReq);
          })
        );
      });

    // 4. 消耗品更新 (已入庫項目，後端 Delta 差額同步)
    const consumableUpdateOps$ = this.gainedConsumableItems()
      .filter(item => !!item.id)
      .map(item => {
        const snapshotReq: AdventureGainedItemRequest = {
          itemName: item.itemName.trim() || '未命名消耗品',
          itemType: 'CONSUMABLE',
          quantity: item.quantity,
          rarity: item.rarity || null,
          notes: item.notes.trim() || null,
        };
        return this.adventureService.updateGainedItem(entryId, item.id!, snapshotReq);
      });

    // 5. 消耗品新增 (尚未入庫項目)
    const consumableCreateOps$ = this.gainedConsumableItems()
      .filter(item => !item.id)
      .map(item => {
        const snapshotReq: AdventureGainedItemRequest = {
          itemName: item.itemName.trim() || '未命名消耗品',
          itemType: 'CONSUMABLE',
          quantity: item.quantity,
          rarity: item.rarity || null,
          notes: item.notes.trim() || null,
        };
        return this.adventureService.addGainedItem(entryId, snapshotReq).pipe(
          concatMap(createdGained => {
            const warehouseReq: InventoryItemRequest = {
              adventureEntryId: entryId,
              adventureGainedItemId: createdGained.id,
              itemType: 'CONSUMABLE',
              itemName: item.itemName.trim() || '未命名消耗品',
              quantity: item.quantity,
              rarity: item.rarity || null,
              source: sourceAdventureName,
              notes: item.notes.trim() || null,
            };
            return this.inventoryService.create(this.characterId, warehouseReq);
          })
        );
      });

    const allOps = [
      ...deleteOps$,
      ...magicUpdateOps$,
      ...magicCreateOps$,
      ...consumableUpdateOps$,
      ...consumableCreateOps$,
    ];
    if (allOps.length === 0) return of(null);

    return from(allOps).pipe(
      concatMap(op$ => op$),
      toArray(),
    );
  }

  private buildRequest(): AdventureEntryRequest {
    const raw = this.form.getRawValue();
    const toDecimal = (v: unknown): number | null =>
      v !== '' && v !== null && v !== undefined && !isNaN(Number(v)) ? Math.round(Number(v) * 100) / 100 : null;
    const toInt = (v: unknown): number | null =>
      v !== '' && v !== null && v !== undefined && !isNaN(Number(v)) ? parseInt(String(v), 10) : null;
    const toDateStr = (val: Date | string | null): string | null => {
      if (!val) return null;
      if (typeof val === 'string') {
        const match = val.match(/^\d{4}-\d{2}-\d{2}/);
        if (match) return match[0];
      }
      const d = val instanceof Date ? val : new Date(val);
      if (isNaN(d.getTime())) return null;
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    return {
      adventureCode: raw.adventureCode?.trim() || null,
      adventureName: raw.adventureName?.trim() || null,
      playDate: toDateStr(raw.playDate),
      dmName: raw.dmName?.trim() || null,
      startingLevel: this._startingLevel(),
      endingLevel: this.endingLevel(),
      startingGold: toDecimal(raw.startingGold),
      goldChange: toDecimal(raw.goldChange),
      goldDowntimeChange: toDecimal(raw.goldDowntimeChange),
      startingDowntime: toInt(raw.startingDowntime),
      downtimeChange: toInt(raw.downtimeChange),
      downtimeDowntimeChange: toInt(raw.downtimeDowntimeChange),
      startingMagicItems: toInt(raw.startingMagicItems),
      magicItemsChange: toInt(raw.magicItemsChange),
      magicItemsDowntimeChange: toInt(raw.magicItemsDowntimeChange),
      adventureNotes: raw.adventureNotes?.trim() || null,
      soulCoinChargesUsed: raw.soulCoinChargesUsed?.trim() || null,
      endingClassesString: this.buildEndingClassesString(),
    };
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.snackBar.open('請填寫必填欄位且確認起始數值不可為負數', '關閉', { duration: 3000 });
      return;
    }
    if (!this.isLevelBalanced()) {
      this.snackBar.open('職業等級加總與結束等級不符，請調整後再儲存', '關閉', { duration: 3000 });
      return;
    }
    if (!this.isResourceValid()) {
      this.snackBar.open('資源起始值與合計皆不得為負值，請調整後再儲存', '關閉', { duration: 3000 });
      return;
    }

    // 防呆驗證：若有卡片未填寫名稱或描述，提示使用者填寫或移除
    const hasEmptyMagic = this.gainedMagicItems().some(item => !item.itemName.trim());
    if (hasEmptyMagic) {
      this.snackBar.open('魔法物品名稱不得為空白，請填寫或刪除該卡片', '關閉', { duration: 3000 });
      return;
    }
    const hasEmptyConsumable = this.gainedConsumableItems().some(item => !item.itemName.trim());
    if (hasEmptyConsumable) {
      this.snackBar.open('消耗品名稱不得為空白，請填寫或刪除該卡片', '關閉', { duration: 3000 });
      return;
    }
    const hasEmptyActivity = this.downtimeActivities().some(act => !act.description.trim());
    if (hasEmptyActivity) {
      this.snackBar.open('休整期活動描述不得為空白，請填寫或刪除該卡片', '關閉', { duration: 3000 });
      return;
    }

    this.isSaving.set(true);
    const req = this.buildRequest();
    const sourceName = req.adventureName || req.adventureCode || '冒險獲得';

    if (this.isEditMode() && this.entryId) {
      this.adventureService.update(this.characterId, this.entryId, req).pipe(
        concatMap(updated => this.syncDowntimeActivities(updated.id).pipe(
          concatMap(() => this.syncGainedItemsToInventory(sourceName, updated.id)),
          map(() => updated),
        )),
      ).subscribe({
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
      this.adventureService.create(this.characterId, req).pipe(
        concatMap(created => this.syncDowntimeActivities(created.id).pipe(
          concatMap(() => this.syncGainedItemsToInventory(sourceName, created.id)),
          map(() => created),
        )),
      ).subscribe({
        next: (created) => {
          this.snackBar.open('冒險記錄已新增', '關閉', { duration: 2500 });
          this.router.navigate(['/characters', this.characterId, 'adventures', created.id]);
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
