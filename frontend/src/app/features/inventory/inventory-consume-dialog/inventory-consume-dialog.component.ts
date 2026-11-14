import { Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { InventoryItem, InventoryMovement } from '../../../core/models/inventory.model';
import { AdventureEntry } from '../../../core/models/adventure.model';
import { AdventureService } from '../../../core/services/adventure.service';
import { InventoryService } from '../../../core/services/inventory.service';
import { FormFeedbackComponent } from '../../../shared/components/form-feedback/form-feedback.component';

export interface InventoryConsumeDialogData {
  characterId: string;
  item?: InventoryItem;
  movement?: InventoryMovement;
  canWrite: () => boolean;
}

@Component({
  selector: 'app-inventory-consume-dialog',
  imports: [
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    FormFeedbackComponent,
  ],
  template: `
    <h2 mat-dialog-title>
      {{ data.item ? '消耗物品' : '編輯紀錄' }}：{{
        data.item?.itemName ?? data.movement?.itemName
      }}
    </h2>
    <form (ngSubmit)="submit()">
      <mat-dialog-content>
        @if (data.item) {
          <p>目前數量：{{ data.item.quantity }}</p>
          <p>確認後會扣除庫存並留下消耗紀錄。</p>
          <mat-form-field>
            <mat-label>消耗數量</mat-label>
            <input
              matInput
              name="quantity"
              type="number"
              min="1"
              step="1"
              [max]="data.item.quantity"
              required
              [(ngModel)]="quantity"
              [disabled]="pending()"
            />
          </mat-form-field>
        }
        <mat-form-field>
          <mat-label>使用冒險（選填）</mat-label>
          <mat-select
            name="adventure"
            [(ngModel)]="usageId"
            [disabled]="pending() || loadingAdventures() || adventureError()"
          >
            <mat-option [value]="null">未指定</mat-option>
            @for (entry of adventures(); track entry.id) {
              <mat-option [value]="entry.id">{{
                entry.adventureName || entry.adventureCode || entry.playDate
              }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        @if (loadingAdventures()) {
          <p role="status">載入中…</p>
        }
        @if (adventureError()) {
          <p role="alert">無法載入冒險，可重試或不選擇冒險。</p>
          <button mat-button type="button" (click)="loadAdventures()" [disabled]="pending()">
            重試
          </button>
        }
        <mat-form-field>
          <mat-label>備註（選填）</mat-label>
          <textarea
            matInput
            name="notes"
            maxlength="2000"
            [(ngModel)]="notes"
            [disabled]="pending()"
          ></textarea>
        </mat-form-field>
        @if (!data.canWrite()) {
          <p role="status">目前為唯讀資料，連線並更新後才能操作。</p>
        }
        <app-form-feedback
          [message]="error()"
          [target]="''"
          [viewUrl]="conflict() ? viewUrl : null"
        />
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" (click)="close()" [disabled]="pending()">取消</button>
        <button
          mat-flat-button
          type="submit"
          [disabled]="
            pending() ||
            !data.canWrite() ||
            conflict() ||
            (!!data.movement && (loadingAdventures() || adventureError()))
          "
        >
          {{ data.item ? '確認消耗' : '儲存' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    mat-form-field {
      display: block;
      width: 100%;
    }
    p,
    h2 {
      overflow-wrap: anywhere;
    }
    mat-dialog-actions {
      flex-wrap: wrap;
      gap: 0.5rem;
      padding: 1rem;
    }
    button {
      min-height: 44px;
    }
  `,
})
export class InventoryConsumeDialogComponent {
  readonly data = inject<InventoryConsumeDialogData>(MAT_DIALOG_DATA);
  private readonly dialog = inject(MatDialogRef<InventoryConsumeDialogComponent>);
  private readonly service = inject(InventoryService);
  private readonly adventureService = inject(AdventureService);
  private readonly destroy = inject(DestroyRef);
  readonly pending = signal(false);
  readonly error = signal<string | null>(null);
  readonly conflict = signal(false);
  readonly adventures = signal<AdventureEntry[]>([]);
  readonly loadingAdventures = signal(false);
  readonly adventureError = signal(false);
  readonly viewUrl = `/characters/${this.data.characterId}/inventory`;
  quantity = 1;
  notes = this.data.movement?.notes ?? '';
  usageId: string | null = this.data.movement?.usageEntryId ?? null;

  constructor() {
    this.loadAdventures();
  }

  loadAdventures(): void {
    this.loadingAdventures.set(true);
    this.adventureError.set(false);
    this.adventureService
      .getAllByCharacter(this.data.characterId, true)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (entries) => {
          this.adventures.set(entries);
          if (!entries.some((e) => e.id === this.usageId)) this.usageId = null;
          this.loadingAdventures.set(false);
        },
        error: () => {
          this.usageId = null;
          this.adventureError.set(true);
          this.loadingAdventures.set(false);
        },
      });
  }

  close(): void {
    if (!this.pending()) this.dialog.close(false);
  }

  submit(): void {
    if (this.pending() || this.conflict() || !this.data.canWrite()) return;
    if (
      this.data.item &&
      (!Number.isSafeInteger(this.quantity) ||
        this.quantity < 1 ||
        this.quantity > this.data.item.quantity)
    ) {
      this.error.set('請輸入不超過目前庫存的正整數。');
      return;
    }
    if (this.notes.length > 2000) return;
    // A failed choice load must not clear an existing association accidentally.
    if (this.data.movement && (this.loadingAdventures() || this.adventureError())) return;
    this.pending.set(true);
    this.dialog.disableClose = true;
    this.error.set(null);
    const request: Observable<unknown> = this.data.item
      ? this.service.consume(
          this.data.characterId,
          this.data.item,
          this.quantity,
          this.notes,
          this.usageId,
        )
      : this.service.updateUsage(
          this.data.characterId,
          this.data.movement!,
          this.usageId === (this.data.movement?.usageEntryId ?? null) ? undefined : this.usageId,
          this.notes,
        );
    request.pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: () => this.dialog.close(true),
      error: (error) => {
        this.pending.set(false);
        this.dialog.disableClose = false;
        this.conflict.set(error.status === 409 || error.status === 428);
        this.error.set(error.error?.message || '儲存失敗');
      },
    });
  }
}
