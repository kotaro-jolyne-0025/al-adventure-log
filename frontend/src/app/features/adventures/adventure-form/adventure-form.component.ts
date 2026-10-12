import { FormFeedbackComponent } from '../../../shared/components/form-feedback/form-feedback.component';
import { DraftNoticeComponent } from '../../../shared/components/draft-notice/draft-notice.component';
import { CommonModule, DecimalPipe } from '@angular/common';
import { afterNextRender, Component, computed, DestroyRef, effect, ElementRef, HostListener, inject, Injector, OnDestroy, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { AdventureDraftSession } from '../../../core/services/adventure-draft-session';
import { adventureBaseline, AdventureDraftInput, draftFormValues, draftText } from '../../../core/models/adventure-draft';
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
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TextFieldModule } from '@angular/cdk/text-field';
import { AdventureService } from '../../../core/services/adventure.service';
import { InventoryService } from '../../../core/services/inventory.service';
import { AdventureEntryRequest, AdventureEntrySaveRequest, AdventureGainedItem } from '../../../core/models/adventure.model';
import { ItemCategory, ItemRarity, ITEM_CATEGORIES, PERMANENT_ITEM_CATEGORIES, ITEM_CATEGORY_LABELS, ITEM_CATEGORY_OPTION_LABELS, ITEM_RARITY_LABELS } from '../../../core/models/inventory.model';
import { DND_CLASSES, parseClassLevels } from '../../../core/models/dnd-classes';
import { of, forkJoin, map, switchMap, takeUntil } from 'rxjs';

import {
  LucideCoins,
  LucideTent,
  LucideSparkles,
  LucideFlaskConical,
  LucideScrollText,
  LucideSwords,
  LucideCalculator,
  LucideStar,
  LucideArrowLeft,
  LucidePlus,
  LucideTrash2,
  LucideCircleCheck,
  LucideCircleAlert,
  LucideSave,
} from '@lucide/angular';

export interface DowntimeActivityItem {
  id?: string;
  presetLabel?: string;
  description: string;
  gold: number | null;
  downtime: number | null;
  magicItems: number | null;
}

export interface StoryAwardFormItem {
  id?: string;
  awardName: string;
  description: string;
}

type MobileOptionalSection = 'magic-items' | 'consumables' | 'story-awards' | 'downtime';

@Component({
  selector: 'app-adventure-form',
  standalone: true,
  providers: [AdventureDraftSession],
  imports: [
    DraftNoticeComponent,
    FormFeedbackComponent,
    CommonModule,
    DecimalPipe,
    ReactiveFormsModule,
    FormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatButtonModule,
    MatProgressSpinner,
    MatSelectModule,
    MatSlideToggleModule,
    MatCheckboxModule,
    MatTooltipModule,
    TextFieldModule,
    LucideCoins,
    LucideTent,
    LucideSparkles,
    LucideFlaskConical,
    LucideScrollText,
    LucideSwords,
    LucideCalculator,
    LucideStar,
    LucideArrowLeft,
    LucidePlus,
    LucideTrash2,
    LucideCircleCheck,
    LucideCircleAlert,
    LucideSave,
  ],
  templateUrl: './adventure-form.component.html',
  styleUrl: './adventure-form.component.scss',
})
export class AdventureFormComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly adventureService = inject(AdventureService);
  private readonly inventoryService = inject(InventoryService);
  private readonly snackBar = inject(MatSnackBar);
  protected readonly draft = inject(AdventureDraftSession);
  private readonly dialog = inject(MatDialog);
  private readonly destroy = inject(DestroyRef);
  private readonly formRevision = signal(0);
  private readonly host = inject(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly dateText = signal('');
  private restoredDraft = false;
  private cloudSaved = false;
  protected readonly recoveredText = signal('');

  constructor() {
    effect(() => {
      this.formRevision();
      this.draft.capture(this.captureInput());
    });
  }

  protected isEditMode = signal(false);
  protected isSaving = signal(false);
  protected isLoading = signal(false);
  protected loadFailed = signal(false);
  private detailsLoaded = false;
  protected characterId!: string;
  protected entryId: string | null = null;

  // ── 5e 職業選項 ─────────────────────────────────────────────────────────────
  readonly CLASS_OPTIONS = DND_CLASSES;

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
    { className: 'Fighter', level: 1 },
  ]);

  protected readonly classesTotalLevel = computed(() =>
    this.classEntries().reduce((sum, e) => sum + (e.level || 0), 0)
  );

  protected readonly isLevelBalanced = computed(() =>
    this.classesTotalLevel() === this.endingLevel()
  );

  protected readonly isClassProgressionValid = computed(() => {
    const current = new Map(this.classEntries().map(item => [item.className.trim(), item.level]));
    return this.parseClassesString(this._startingClassesString()).every(
      item => (current.get(item.className) ?? 0) >= item.level
    );
  });

  // ── 資源計算 Signals ────────────────────────────────────────────────────────
  private readonly _startingGold = signal<number | null>(null);
  private readonly _goldChange = signal<number | null>(null);
  private readonly _goldDowntimeChange = signal<number | null>(null);
  private readonly _startingDowntime = signal<number | null>(null);
  private readonly _downtimeChange = signal<number | null>(null);
  private readonly _downtimeDowntimeChange = signal<number | null>(null);
  private readonly _startingMagicItems = signal<number | null>(null);
  private readonly _magicItemsLost = signal(0);
  private readonly _magicItemsDowntimeLost = signal(0);
  protected readonly adventureMagicGained = computed(() => this.gainedMagicItems().filter(item => item.acquisitionSource !== 'DOWNTIME').length);
  protected readonly downtimeMagicGained = computed(() => this.gainedMagicItems().filter(item => item.acquisitionSource === 'DOWNTIME').length);
  protected readonly _magicItemsChange = computed(() => this.adventureMagicGained() - this._magicItemsLost());
  protected readonly _magicItemsDowntimeChange = computed(() => this.downtimeMagicGained() - this._magicItemsDowntimeLost());

  protected readonly goldNetChange = computed(() =>
    Math.round(((this._goldChange() ?? 0) + (this._goldDowntimeChange() ?? 0)) * 100) / 100
  );
  protected readonly downtimeNetChange = computed(() =>
    (this._downtimeChange() ?? 0) + (this._downtimeDowntimeChange() ?? 0)
  );
  protected readonly magicItemsNetChange = computed(() =>
    (this._magicItemsChange() ?? 0) + (this._magicItemsDowntimeChange() ?? 0)
  );

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
  readonly categories = ITEM_CATEGORIES;
  readonly permanentCategories = PERMANENT_ITEM_CATEGORIES;
  readonly categoryLabels = ITEM_CATEGORY_LABELS;
  readonly categoryOptionLabels = ITEM_CATEGORY_OPTION_LABELS;

  protected gainedMagicItems = signal<{
    id?: string;
    itemName: string;
    rarity: ItemRarity | '';
    itemCategory: ItemCategory | '';
    requiresAttunement?: boolean;
    acquisitionSource?: 'ADVENTURE' | 'DOWNTIME' | null;
    needsDetails?: boolean;
    notes: string;
  }[]>([]);

  protected gainedConsumableItems = signal<{
    id?: string;
    itemName: string;
    quantity: number;
    isSoulCoin?: boolean;
    rarity: ItemRarity | '';
    itemCategory: ItemCategory | '';
    notes: string;
  }[]>([]);

  // ── 本次獲得的故事獎勵清單 ──────────────────────────────────────────
  protected storyAwards = signal<StoryAwardFormItem[]>([]);

  // ── 休整期活動卡片清單 ────────────────────────────────────────────────────
  protected downtimeActivities = signal<DowntimeActivityItem[]>([]);

  private readonly collapsedSections = signal(new Set<MobileOptionalSection>());
  private readonly itemDetailsChecked = signal(false);
  protected readonly hasItemDetailsError = computed(() => this.itemDetailsChecked() &&
    [...this.gainedMagicItems(), ...this.gainedConsumableItems()].some(item => !item.itemName.trim()));
  protected readonly legacyMagicWarning = signal(false);

  protected isSectionExpanded(section: MobileOptionalSection, count: number): boolean {
    return (count > 0 && !this.collapsedSections().has(section))
      || ((section === 'magic-items' || section === 'consumables') && this.hasItemDetailsError());
  }

  protected toggleSection(section: MobileOptionalSection): void {
    this.collapsedSections.update(sections => {
      const next = new Set(sections);
      next.has(section) ? next.delete(section) : next.add(section);
      return next;
    });
  }

  private expandSection(section: MobileOptionalSection): void {
    this.collapsedSections.update(sections => {
      const next = new Set(sections);
      next.delete(section);
      return next;
    });
  }

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
    magicItemsLost: [0, [Validators.min(0), Validators.pattern(/^[0-9]+$/)]],
    magicItemsDowntimeLost: [0, [Validators.min(0), Validators.pattern(/^[0-9]+$/)]],
    adventureNotes: [''],
    soulCoinChargesUsed: [''],
  });

  ngOnInit(): void {
    this.characterId =
      this.route.parent?.snapshot.paramMap.get('id') ??
      this.route.snapshot.paramMap.get('characterId') ?? '';
    const entryIdParam = this.route.snapshot.paramMap.get('entryId');
    void this.draft.start(this.characterId, entryIdParam ? `adventure:${entryIdParam}` : 'adventure:new');
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroy)).subscribe(() => this.formRevision.update(value => value + 1));

    this.form.get('startingGold')!.valueChanges.subscribe(v => this._startingGold.set(v != null && v !== '' ? Number(v) : null));
    this.form.get('goldChange')!.valueChanges.subscribe(v => this._goldChange.set(v != null && v !== '' ? Number(v) : null));
    this.form.get('goldDowntimeChange')!.valueChanges.subscribe(v => this._goldDowntimeChange.set(v != null && v !== '' ? Number(v) : null));
    this.form.get('startingDowntime')!.valueChanges.subscribe(v => this._startingDowntime.set(v != null && v !== '' ? Number(v) : null));
    this.form.get('downtimeChange')!.valueChanges.subscribe(v => this._downtimeChange.set(v != null && v !== '' ? Number(v) : null));
    this.form.get('downtimeDowntimeChange')!.valueChanges.subscribe(v => this._downtimeDowntimeChange.set(v != null && v !== '' ? Number(v) : null));
    this.form.get('startingMagicItems')!.valueChanges.subscribe(v => this._startingMagicItems.set(v != null && v !== '' ? Number(v) : null));
    this.form.get('magicItemsLost')!.valueChanges.subscribe(v => this._magicItemsLost.set(Number(v) || 0));
    this.form.get('magicItemsDowntimeLost')!.valueChanges.subscribe(v => this._magicItemsDowntimeLost.set(Number(v) || 0));

    if (entryIdParam) {
      this.isEditMode.set(true);
      this.entryId = entryIdParam;
      this.loadEntry(this.entryId);
    } else {
      this.loadDefaults();
    }
  }

  private parseClassesString(classesString?: string | null): { className: string; level: number }[] {
    return parseClassLevels(classesString);
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
    this.isLoading.set(true);
    this.loadFailed.set(false);
    forkJoin({
      d: this.adventureService.getDefaults(this.characterId, true),
      inventory: this.inventoryService.getAllByCharacter(this.characterId, true),
    }).pipe(takeUntil(this.draft.retired), takeUntilDestroyed(this.destroy)).subscribe({
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
        this.isLoading.set(false);
        this.draft.cloudLoaded(null, this.captureInput());
      },
      error: () => { this.isLoading.set(false); this.loadFailed.set(true); },
    });
  }

  private loadEntry(id: string): void {
    this.isLoading.set(true);
    this.loadFailed.set(false);
    this.detailsLoaded = false;
    forkJoin({
      entry: this.adventureService.getById(this.characterId, id),
      gainedItems: this.adventureService.getGainedItems(id),
      storyAwards: this.adventureService.getStoryAwards(id),
    }).pipe(
      switchMap(result => {
        if (result.gainedItems.length > 0) return of(result);
        // Only a successful empty snapshot response permits the legacy fallback.
        return this.inventoryService.getAllByCharacter(this.characterId).pipe(
          map(items => ({
            ...result,
            gainedItems: items.filter(item =>
              !item.adventureGainedItemId &&
              (item.adventureEntryId === id ||
                (!item.adventureEntryId && this.isSourceMatch(item.source,
                  result.entry.adventureName, result.entry.adventureCode)))
            ).map(item => ({ ...item, adventureEntryId: id })),
          }))
        );
      })
    ).pipe(takeUntil(this.draft.retired), takeUntilDestroyed(this.destroy)).subscribe({
      next: ({ entry, gainedItems, storyAwards }) => {
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
            const goldMatch = deltasStr.match(/金幣\s*([+-]?\d+(?:\.\d+)?)\s*(?:gp|金)/i);
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
          adventureNotes: entry.adventureNotes ?? '',
          soulCoinChargesUsed: entry.soulCoinChargesUsed ?? '',
        });

        this.applyGainedItems(gainedItems);
        this.form.patchValue({
          magicItemsLost: entry.magicItemsLost ?? Math.max(0, this.adventureMagicGained() - (entry.magicItemsChange ?? 0)),
          magicItemsDowntimeLost: entry.magicItemsDowntimeLost ?? Math.max(0, this.downtimeMagicGained() - (entry.magicItemsDowntimeChange ?? 0)),
        });
        this.legacyMagicWarning.set(this._magicItemsChange() !== (entry.magicItemsChange ?? 0) || this._magicItemsDowntimeChange() !== (entry.magicItemsDowntimeChange ?? 0));
        this.storyAwards.set(storyAwards.map(a => ({
          id: a.id, awardName: a.awardName, description: a.description || '',
        })));
        this.detailsLoaded = true;
        this.isLoading.set(false);
        this.draft.cloudLoaded(adventureBaseline({ entry, gainedItems, storyAwards }), this.captureInput());
      },
      error: () => {
        this.isLoading.set(false);
        this.loadFailed.set(true);
      },
    });
  }

  protected retryLoad(): void {
    if (this.isLoading()) return;
    if (this.entryId) this.loadEntry(this.entryId);
    else this.loadDefaults();
  }

  private captureInput(): AdventureDraftInput {
    const form = draftFormValues(this.form.getRawValue());
    if (!form['playDate'] && this.dateText()) form['playDateText'] = this.dateText();
    return structuredClone({ form,
      levelUp: this.levelUp(), catchup: this.catchup(), catchupCount: this.catchupCount(), classes: this.classEntries(),
      magicItems: this.gainedMagicItems(), consumables: this.gainedConsumableItems(),
      awards: this.storyAwards(), activities: this.downtimeActivities() });
  }

  protected restoreDraft(): void {
    const input = this.draft.accept();
    if (!input) return;
    const { startingGold, startingDowntime, startingMagicItems, ...editable } = input.form;
    this.form.patchValue({ ...editable, playDate: this.parseLocalDate(editable['playDate'] as string | null) });
    this.dateText.set((editable['playDateText'] as string) ?? '');
    if (!editable['playDate'] && this.dateText()) queueMicrotask(() => {
      const dateInput = this.host.nativeElement.querySelector('input[formcontrolname="playDate"]') as HTMLInputElement | null;
      if (dateInput) dateInput.value = this.dateText();
    });
    this.levelUp.set(input.levelUp); this.catchup.set(input.catchup); this.catchupCount.set(input.catchupCount);
    this.classEntries.set(input.classes);
    this.gainedMagicItems.set(input.magicItems as ReturnType<typeof this.gainedMagicItems>);
    this.gainedConsumableItems.set(input.consumables as ReturnType<typeof this.gainedConsumableItems>);
    this.storyAwards.set(input.awards); this.downtimeActivities.set(input.activities);
    this.restoredDraft = this.isEditMode();
    this.form.markAsDirty();
  }

  protected discardDraft(): void {
    this.dialog.open(ConfirmDialogComponent, { width: '360px', data: {
      title: '捨棄本機草稿', intent: 'destructive', message: '確定要移除此裝置上的草稿嗎？雲端正式紀錄不會被刪除。',
      confirmText: '捨棄草稿', cancelText: '保留草稿' } }).afterClosed().subscribe(confirmed => {
      if (confirmed) { void this.draft.discard(); this.recoveredText.set(''); }
    });
  }

  protected recoverDraftText(): void {
    const input = this.draft.offered() ? this.draft.record()?.data?.input ?? this.draft.record()?.data : this.captureInput();
    this.recoveredText.set(draftText(input));
    afterNextRender(() => this.host.nativeElement.querySelector('app-draft-notice textarea')?.focus(), { injector: this.injector });
  }

  protected retryDraftSave(): void { this.draft.capture(this.captureInput()); void this.draft.flush(); }

  @HostListener('document:visibilitychange')
  protected saveOnBackground(): void {
    if (document.visibilityState === 'hidden') this.flushDraft();
  }

  private flushDraft(): void {
    if (this.cloudSaved) return;
    this.draft.capture(this.captureInput()); void this.draft.flush();
  }

  ngOnDestroy(): void { this.flushDraft(); }

  private isSourceMatch(
    itemSource: string | null | undefined,
    advName?: string | null,
    advCode?: string | null
  ): boolean {
    if (!itemSource) return false;
    const s = itemSource.trim().toLowerCase();
    const name = advName?.trim().toLowerCase();
    const code = advCode?.trim().toLowerCase();

    return !!((name && s === name) || (code && s === code));
  }

  private applyGainedItems(items: AdventureGainedItem[]): void {
    this.gainedMagicItems.set(items
      .filter(item => item.itemType === 'PERMANENT')
      .map(item => ({
        id: item.id,
        itemName: item.itemName,
        rarity: (item.rarity ?? '') as ItemRarity | '',
        itemCategory: (item.itemCategory ?? '') as ItemCategory | '',
        requiresAttunement: Boolean(item.requiresAttunement),
        acquisitionSource: item.acquisitionSource,
        needsDetails: item.needsDetails,
        notes: item.notes ?? '',
      })));
    this.gainedConsumableItems.set(items
      .filter(item => item.itemType === 'CONSUMABLE')
      .map(item => ({
        id: item.id,
        itemName: item.itemName,
        quantity: item.quantity ?? 1,
        isSoulCoin: Boolean(item.isSoulCoin),
        rarity: (item.rarity ?? '') as ItemRarity | '',
        itemCategory: (item.itemCategory ?? '') as ItemCategory | '',
        notes: item.notes ?? '',
      })));
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
      { className: 'Wizard', level: 1 },
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
    this.expandSection('downtime');
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
    let hasGold = false;
    let hasDowntime = false;

    for (const item of list) {
      if (item.gold != null && !isNaN(item.gold)) {
        totalGold += item.gold;
        hasGold = true;
      }
      if (item.downtime != null && !isNaN(item.downtime)) {
        totalDowntime += item.downtime;
        hasDowntime = true;
      }
    }

    this.form.patchValue({
      goldDowntimeChange: hasGold ? Math.round(totalGold * 100) / 100 : (list.length > 0 ? 0 : null),
      downtimeDowntimeChange: hasDowntime ? totalDowntime : (list.length > 0 ? 0 : null),

    });
  }

  private formatActivityFullDescription(item: DowntimeActivityItem): string {
    const text = item.description.trim() || '休整期活動';
    const deltas: string[] = [];
    if (item.gold != null && !isNaN(item.gold) && item.gold !== 0) {
      deltas.push(`金幣 ${item.gold > 0 ? '+' : ''}${item.gold} 金`);
    }
    if (item.downtime != null && !isNaN(item.downtime) && item.downtime !== 0) {
      deltas.push(`休整期 ${item.downtime > 0 ? '+' : ''}${item.downtime} 天`);
    }
    if (item.magicItems != null && !isNaN(item.magicItems) && item.magicItems !== 0) {
      deltas.push(`魔法物品 ${item.magicItems > 0 ? '+' : ''}${item.magicItems} 件`);
    }
    return deltas.length > 0 ? `${text} (${deltas.join(', ')})` : text;
  }

  // ── 獲得永久性魔法物品清單操作 ──────────────────────────────────────────
  protected addGainedItem(): void {
    this.expandSection('magic-items');
    this.gainedMagicItems.update(list => [
      ...list,
      { itemName: '', rarity: '', itemCategory: '', requiresAttunement: false, notes: '' },
    ]);

  }

  protected removeGainedItem(index: number): void {
    const removed = this.gainedMagicItems()[index];
    this.gainedMagicItems.update(list => list.filter((_, i) => i !== index));

  }

  protected updateGainedItemSource(index: number, acquisitionSource: 'ADVENTURE' | 'DOWNTIME'): void {
    this.gainedMagicItems.update(items => items.map((item, i) => i === index ? { ...item, acquisitionSource } : item));
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

  protected updateGainedItemCategory(index: number, itemCategory: ItemCategory | ''): void {
    this.gainedMagicItems.update(list => list.map((item, i) => i === index ? { ...item, itemCategory } : item));
  }

  protected updateGainedItemAttunement(index: number, attune: boolean): void {
    this.gainedMagicItems.update(list =>
      list.map((item, i) => i === index ? { ...item, requiresAttunement: attune } : item)
    );
  }

  protected updateGainedItemNotes(index: number, notes: string): void {
    this.gainedMagicItems.update(list =>
      list.map((item, i) => i === index ? { ...item, notes } : item)
    );
  }

  // ── 獲得消耗品清單操作 ──────────────────────────────────────────
  protected addGainedConsumableItem(): void {
    this.expandSection('consumables');
    this.gainedConsumableItems.update(list => [
      ...list,
      { itemName: '', quantity: 1, isSoulCoin: false, rarity: '', itemCategory: '', notes: '' },
    ]);
  }

  protected removeGainedConsumableItem(index: number): void {
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

  protected updateGainedConsumableItemCategory(index: number, itemCategory: ItemCategory | ''): void {
    this.gainedConsumableItems.update(list => list.map((item, i) => i === index ? { ...item, itemCategory } : item));
  }

  protected updateGainedConsumableItemSoulCoin(index: number, isSoulCoin: boolean): void {
    this.gainedConsumableItems.update(list => list.map((item, i) => i === index ? { ...item, isSoulCoin } : item));
  }

  protected updateGainedConsumableItemNotes(index: number, notes: string): void {
    this.gainedConsumableItems.update(list =>
      list.map((item, i) => i === index ? { ...item, notes } : item)
    );
  }

  // ── 故事獎勵操作 ──────────────────────────────────────────
  protected addStoryAward(): void {
    this.expandSection('story-awards');
    this.storyAwards.update(list => [
      ...list,
      { awardName: '', description: '' },
    ]);
  }

  protected removeStoryAward(index: number): void {
    this.storyAwards.update(list => list.filter((_, i) => i !== index));
  }

  protected updateStoryAwardName(index: number, name: string): void {
    this.storyAwards.update(list =>
      list.map((item, i) => i === index ? { ...item, awardName: name } : item)
    );
  }

  protected updateStoryAwardDescription(index: number, desc: string): void {
    this.storyAwards.update(list =>
      list.map((item, i) => i === index ? { ...item, description: desc } : item)
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
    const startingClasses = new Map(
      this.parseClassesString(this._startingClassesString()).map(item => [item.className, item.level])
    );
    const levelChange = this.endingLevel() - this._startingLevel();
    let classChanges = this.classEntries()
      .map(item => ({
        className: item.className.trim(),
        levelChange: item.level - (startingClasses.get(item.className.trim()) ?? 0),
      }))
      .filter(item => item.className && item.levelChange > 0);
    if (levelChange === 0) {
      classChanges = [];
    } else if (classChanges.reduce((sum, item) => sum + item.levelChange, 0) !== levelChange) {
      const fallbackClass = this.classEntries().find(item => item.className.trim())?.className.trim();
      classChanges = fallbackClass ? [{ className: fallbackClass, levelChange }] : [];
    }
    return {
      adventureCode: raw.adventureCode?.trim() || null,
      adventureName: raw.adventureName?.trim() || null,
      playDate: toDateStr(raw.playDate),
      dmName: raw.dmName?.trim() || null,
      levelChange,
      classChanges,
      goldChange: toDecimal(raw.goldChange),
      goldDowntimeChange: toDecimal(raw.goldDowntimeChange),
      downtimeChange: toInt(raw.downtimeChange),
      downtimeDowntimeChange: toInt(raw.downtimeDowntimeChange),
      magicItemsChange: this._magicItemsChange(),
      magicItemsLost: toInt(raw.magicItemsLost),
      magicItemsDowntimeChange: this._magicItemsDowntimeChange(),
      magicItemsDowntimeLost: toInt(raw.magicItemsDowntimeLost),
      adventureNotes: raw.adventureNotes?.trim() || null,
      soulCoinChargesUsed: raw.soulCoinChargesUsed?.trim() || null,
    };
  }

  private buildSaveRequest(entry: AdventureEntryRequest): AdventureEntrySaveRequest {
    return {
      entry,
      downtimeActivities: this.downtimeActivities().map(item => ({
        id: item.id,
        description: this.formatActivityFullDescription(item),
      })),
      gainedItems: [
        ...this.gainedMagicItems().map(item => ({
          id: item.id,
          itemName: item.itemName.trim(),
          itemType: 'PERMANENT' as const,
          acquisitionSource: item.acquisitionSource ?? 'ADVENTURE',
          rarity: item.rarity || null,
          itemCategory: item.itemCategory || null,
          requiresAttunement: Boolean(item.requiresAttunement),
          notes: item.notes.trim() || null,
        })),
        ...this.gainedConsumableItems().map(item => ({
          id: item.id,
          itemName: item.itemName.trim(),
          itemType: 'CONSUMABLE' as const,
          quantity: item.quantity,
          isSoulCoin: Boolean(item.isSoulCoin),
          rarity: item.rarity || null,
          itemCategory: item.itemCategory || null,
          notes: item.notes.trim() || null,
        })),
      ],
      storyAwards: this.storyAwards().map(item => ({
        id: item.id,
        awardName: item.awardName.trim(),
        description: item.description.trim() || null,
      })),
    };
  }

  protected formError = signal<string | null>(null);
  protected errorTarget = signal('input.ng-invalid, textarea.ng-invalid, mat-select.ng-invalid');

  protected onSubmit(): void {
    this.formError.set(null);
    if (this.isSaving() || this.isLoading() || this.loadFailed() || this.draft.offered() ||
        (this.isEditMode() && !this.detailsLoaded)) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.formError.set('請填寫必填欄位且確認起始數值不可為負數');
      this.errorTarget.set('input.ng-invalid, textarea.ng-invalid, mat-select.ng-invalid');
      return;
    }
    if (!this.isLevelBalanced()) {
      this.formError.set('職業等級加總與結束等級不符，請調整後再儲存');
      this.errorTarget.set('.level-management-card');
      return;
    }
    if (!this.isClassProgressionValid()) {
      this.formError.set('既有職業等級不可降低，請只分配本次增加的等級');
      this.errorTarget.set('.level-management-card');
      return;
    }
    if (!this.isResourceValid()) {
      this.formError.set('資源起始值與合計皆不得為負值，請調整後再儲存');
      this.errorTarget.set('.resource-blocks-grid');
      return;
    }

    // 防呆驗證：若有卡片未填寫名稱或描述，提示使用者填寫或移除
    this.itemDetailsChecked.set(true);
    const hasEmptyMagic = this.gainedMagicItems().some(item => !item.itemName.trim());
    if (hasEmptyMagic) {
      this.expandSection('magic-items');
      this.formError.set('魔法物品名稱不得為空白，請填寫或刪除該卡片');
      this.errorTarget.set('#magic-items-content');
      return;
    }
    const hasEmptyConsumable = this.gainedConsumableItems().some(item => !item.itemName.trim());
    if (hasEmptyConsumable) {
      this.expandSection('consumables');
      this.formError.set('消耗品名稱不得為空白，請填寫或刪除該卡片');
      this.errorTarget.set('#consumables-content');
      return;
    }
    const hasEmptyActivity = this.downtimeActivities().some(act => !act.description.trim());
    if (hasEmptyActivity) {
      this.expandSection('downtime');
      this.formError.set('休整期活動描述不得為空白，請填寫或刪除該卡片');
      this.errorTarget.set('#downtime-content');
      return;
    }
    const hasEmptyStoryAward = this.storyAwards().some(award => !award.awardName.trim());
    if (hasEmptyStoryAward) {
      this.expandSection('story-awards');
      this.formError.set('故事獎勵名稱不得為空白，請填寫或刪除該卡片');
      this.errorTarget.set('#story-awards-content');
      return;
    }

    this.isSaving.set(true);
    this.flushDraft();
    this.draft.pause();
    const req = this.buildRequest();
    const saveRequest = this.buildSaveRequest(req);

    if (this.isEditMode() && this.entryId) {
      const submit = this.restoredDraft ? this.readCloudBaseline().pipe(switchMap(baseline => {
        if (!this.draft.baselineMatches(baseline)) throw new Error('雲端紀錄已更新，請先取回草稿文字並重新載入，避免覆蓋電腦整理的內容。');
        return this.adventureService.updateWithDetails(this.characterId, this.entryId!, saveRequest);
      })) : this.adventureService.updateWithDetails(this.characterId, this.entryId, saveRequest);
      submit.pipe(takeUntil(this.draft.retired), takeUntilDestroyed(this.destroy)).subscribe({
        next: (updated) => {
          void this.completeSave(updated.id, '記錄已更新');
        },
        error: (error) => {
          this.isSaving.set(false);
          this.formError.set(error.error?.message || error.message || '更新失敗，請稍後再試');
          if (error.status === 0 || error.status >= 500) this.formError.set('儲存結果尚未確認，草稿會保留。請先查看雲端紀錄，再決定是否重新儲存。');
          this.errorTarget.set('');
        },
      });
    } else {
      this.adventureService.createWithDetails(this.characterId, saveRequest)
        .pipe(takeUntil(this.draft.retired), takeUntilDestroyed(this.destroy)).subscribe({
        next: (created) => {
          void this.completeSave(created.id, '冒險記錄已新增');
        },
        error: (error) => {
          this.isSaving.set(false);
          this.formError.set(error.error?.message || '新增失敗，請稍後再試');
          if (error.status === 0 || error.status >= 500) this.formError.set('儲存結果尚未確認，草稿會保留。請先查看雲端紀錄，再決定是否重新儲存。');
          this.errorTarget.set('');
        },
      });
    }
  }

  protected onBack(): void {
    this.flushDraft();
    if (this.isEditMode() && this.entryId) {
      this.router.navigate(['/characters', this.characterId, 'adventures', this.entryId]);
    } else {
      this.router.navigate(['/characters', this.characterId, 'adventures']);
    }
  }

  private async completeSave(id: string, message: string): Promise<void> {
    if (!this.draft.isCurrentOwner()) return;
    this.cloudSaved = true;
    const cleared = await this.draft.savedToCloud(id);
    if (!this.draft.isCurrentOwner()) return;
    this.snackBar.open(cleared ? message : '雲端已儲存，本機草稿尚未清除，請先查看雲端紀錄。', '關閉', { duration: cleared ? 2500 : 8000 });
    void this.router.navigate(['/characters', this.characterId, 'adventures', id]);
  }

  private readCloudBaseline() {
    return forkJoin({ entry: this.adventureService.getById(this.characterId, this.entryId!),
      gainedItems: this.adventureService.getGainedItems(this.entryId!), storyAwards: this.adventureService.getStoryAwards(this.entryId!)
    }).pipe(switchMap(result => result.gainedItems.length ? of(result)
      : this.inventoryService.getAllByCharacter(this.characterId, true).pipe(map(items => ({ ...result,
        gainedItems: items.filter(item => !item.adventureGainedItemId && (item.adventureEntryId === this.entryId ||
          (!item.adventureEntryId && this.isSourceMatch(item.source, result.entry.adventureName, result.entry.adventureCode))))
          .map(item => ({ ...item, adventureEntryId: this.entryId! })) })))), map(adventureBaseline));
  }
}
