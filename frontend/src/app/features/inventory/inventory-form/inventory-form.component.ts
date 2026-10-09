import { FormFeedbackComponent } from '../../../shared/components/form-feedback/form-feedback.component';
import { ReadErrorComponent, readErrorMessage } from '../../../shared/components/read-error/read-error.component';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinner } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LucideArrowLeft, LucideSave } from '@lucide/angular';
import { InventoryService } from '../../../core/services/inventory.service';
import {
  ItemType,
  ItemRarity,
  ItemCategory,
  ITEM_CATEGORIES,
  ITEM_CATEGORY_LABELS,
  ITEM_CATEGORY_OPTION_LABELS,
  ITEM_TYPE_LABELS,
  ITEM_RARITY_LABELS,
  InventoryItemRequest,
} from '../../../core/models/inventory.model';

@Component({
  selector: 'app-inventory-form',
  standalone: true,
  imports: [
    FormFeedbackComponent,
    ReadErrorComponent,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    MatProgressSpinner,
    LucideArrowLeft,
    LucideSave,
  ],
  templateUrl: './inventory-form.component.html',
  styleUrl: './inventory-form.component.scss',
})
export class InventoryFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly inventoryService = inject(InventoryService);
  private readonly snackBar = inject(MatSnackBar);

  protected isEditMode = signal(false);
  protected isSaving = signal(false);
  protected isLoading = signal(false);
  protected loadError = signal<string | null>(null);
  protected retryable = signal(true);
  protected itemLoaded = signal(false);
  protected characterId!: string;
  private itemId?: string;

  readonly itemTypes: ItemType[] = ['PERMANENT', 'CONSUMABLE'];
  readonly rarities: (ItemRarity | '')[] = ['', 'COMMON', 'UNCOMMON', 'RARE', 'VERY_RARE', 'LEGENDARY', 'ARTIFACT'];
  readonly typeLabels = ITEM_TYPE_LABELS;
  readonly rarityLabels = ITEM_RARITY_LABELS;
  readonly categories = ITEM_CATEGORIES;
  readonly categoryLabels = ITEM_CATEGORY_LABELS;
  readonly categoryOptionLabels = ITEM_CATEGORY_OPTION_LABELS;

  protected form: FormGroup = this.fb.group({
    itemName: ['', Validators.required],
    itemType: ['PERMANENT', Validators.required],
    rarity: [''],
    itemCategory: [''],
    requiresAttunement: [false],
    quantity: [1],
    source: [''],
    notes: [''],
  });

  ngOnInit(): void {
    this.characterId =
      this.route.parent?.snapshot.paramMap.get('id') ??
      this.route.snapshot.paramMap.get('characterId') ?? '';

    // Pre-set type from query param (when coming from Tab)
    const typeParam = this.route.snapshot.queryParamMap.get('type') as ItemType;
    if (typeParam) {
      this.form.patchValue({ itemType: typeParam });
    }

    const itemIdParam = this.route.snapshot.paramMap.get('itemId');
    if (itemIdParam) {
      this.isEditMode.set(true);
      this.itemId = itemIdParam;
      this.loadItem(this.itemId);
    }
  }

  protected retryLoad(): void {
    if (this.itemId && !this.isLoading()) this.loadItem(this.itemId);
  }

  private loadItem(id: string): void {
    this.isLoading.set(true);
    this.itemLoaded.set(false);
    this.loadError.set(null);
    this.form.disable();
    this.inventoryService.getAllByCharacter(this.characterId).subscribe({
      next: (items) => {
        const item = items.find((i) => i.id === id);
        if (!item) {
          this.isLoading.set(false);
          this.retryable.set(false);
          this.loadError.set('找不到此物品，資料可能已移除。');
          return;
        }
        this.form.patchValue({
          itemName: item.itemName,
          itemType: item.itemType,
          rarity: item.rarity ?? '',
          itemCategory: item.itemCategory ?? '',
          requiresAttunement: Boolean(item.requiresAttunement),
          quantity: item.quantity,
          source: item.source ?? '',
          notes: item.notes ?? '',
        });
        this.form.enable();
        this.itemLoaded.set(true);
        this.isLoading.set(false);
      },
      error: (error) => {
        this.isLoading.set(false);
        this.retryable.set(![401, 403, 404].includes(error.status));
        this.loadError.set(readErrorMessage(error, '物品'));
      },
    });
  }

  protected formError = signal<string | null>(null);
  protected errorTarget = signal('input.ng-invalid, textarea.ng-invalid, mat-select.ng-invalid');

  protected onSubmit(): void {
    this.formError.set(null);
    if (this.isSaving() || this.isLoading() || (this.isEditMode() && !this.itemLoaded())) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
        this.formError.set('請修正必填欄位、職業或數值後再儲存。');
        this.errorTarget.set('input.ng-invalid, textarea.ng-invalid, mat-select.ng-invalid, .form-section mat-select');
      return;
    }
    this.isSaving.set(true);
    const raw = this.form.getRawValue();
    const isPermanent = raw.itemType === 'PERMANENT';
    const req: InventoryItemRequest = {
      itemName: raw.itemName.trim(),
      itemType: raw.itemType as ItemType,
      rarity: raw.rarity || null,
      itemCategory: (raw.itemCategory || null) as ItemCategory | null,
      requiresAttunement: isPermanent ? Boolean(raw.requiresAttunement) : false,
      quantity: raw.quantity ? Number(raw.quantity) : 1,
      source: raw.source?.trim() || null,
      notes: raw.notes?.trim() || null,
    };

    if (this.isEditMode() && this.itemId) {
      this.inventoryService.update(this.characterId, this.itemId, req).subscribe({
        next: () => {
          this.snackBar.open('物品已更新', '關閉', { duration: 2500 });
          this.router.navigate(['/characters', this.characterId, 'inventory']);
        },
        error: () => {
          this.isSaving.set(false);
          this.formError.set('更新失敗');
          this.errorTarget.set('');
        },
      });
    } else {
      this.inventoryService.create(this.characterId, req).subscribe({
        next: () => {
          this.snackBar.open('物品已新增', '關閉', { duration: 2500 });
          this.router.navigate(['/characters', this.characterId, 'inventory']);
        },
        error: () => {
          this.isSaving.set(false);
          this.formError.set('新增失敗');
          this.errorTarget.set('');
        },
      });
    }
  }

  protected onBack(): void {
    this.router.navigate(['/characters', this.characterId, 'inventory']);
  }
}
