import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LucideArrowLeft, LucideSave } from '@lucide/angular';
import { InventoryService } from '../../../core/services/inventory.service';
import {
  ItemType,
  ItemRarity,
  ITEM_TYPE_LABELS,
  ITEM_RARITY_LABELS,
  InventoryItemRequest,
} from '../../../core/models/inventory.model';

@Component({
  selector: 'app-inventory-form',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    MatProgressSpinnerModule,
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
  private characterId!: string;
  private itemId?: string;

  readonly itemTypes: ItemType[] = ['PERMANENT', 'CONSUMABLE'];
  readonly rarities: (ItemRarity | '')[] = ['', 'COMMON', 'UNCOMMON', 'RARE', 'VERY_RARE', 'LEGENDARY', 'ARTIFACT'];
  readonly typeLabels = ITEM_TYPE_LABELS;
  readonly rarityLabels = ITEM_RARITY_LABELS;

  protected form: FormGroup = this.fb.group({
    itemName: ['', Validators.required],
    itemType: ['PERMANENT', Validators.required],
    rarity: [''],
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

  private loadItem(id: string): void {
    this.inventoryService.getAllByCharacter(this.characterId).subscribe({
      next: (items) => {
        const item = items.find((i) => i.id === id);
        if (!item) {
          this.snackBar.open('找不到此物品', '關閉', { duration: 3000 });
          this.onBack();
          return;
        }
        this.form.patchValue({
          itemName: item.itemName,
          itemType: item.itemType,
          rarity: item.rarity ?? '',
          requiresAttunement: Boolean(item.requiresAttunement),
          quantity: item.quantity,
          source: item.source ?? '',
          notes: item.notes ?? '',
        });
      },
      error: () => {
        this.snackBar.open('載入物品失敗', '關閉', { duration: 3000 });
        this.onBack();
      },
    });
  }

  protected onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.isSaving.set(true);
    const raw = this.form.getRawValue();
    const isPermanent = raw.itemType === 'PERMANENT';
    const req: InventoryItemRequest = {
      itemName: raw.itemName.trim(),
      itemType: raw.itemType as ItemType,
      rarity: raw.rarity || null,
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
          this.snackBar.open('更新失敗', '關閉', { duration: 3000 });
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
          this.snackBar.open('新增失敗', '關閉', { duration: 3000 });
        },
      });
    }
  }

  protected onBack(): void {
    this.router.navigate(['/characters', this.characterId, 'inventory']);
  }
}
