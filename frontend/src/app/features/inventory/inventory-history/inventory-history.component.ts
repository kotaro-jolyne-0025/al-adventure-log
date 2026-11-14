import {
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  OnChanges,
  SimpleChanges,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { LucideChevronDown, LucideEllipsis } from '@lucide/angular';
import { InventoryMovement } from '../../../core/models/inventory.model';
import { InventoryService } from '../../../core/services/inventory.service';
import { watchReadPage } from '../../../core/services/local-read-cache.service';
import { LocalStore } from '../../../core/services/local-store.service';
import {
  ReadErrorComponent,
  readErrorMessage,
} from '../../../shared/components/read-error/read-error.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { InventoryConsumeDialogComponent } from '../inventory-consume-dialog/inventory-consume-dialog.component';

@Component({
  selector: 'app-inventory-history',
  imports: [
    DatePipe,
    RouterLink,
    MatButtonModule,
    MatMenuModule,
    LucideChevronDown,
    LucideEllipsis,
    ReadErrorComponent,
  ],
  template: `
    <section
      [attr.aria-label]="usageAdventureEntryId() ? '消耗紀錄' : '物品異動紀錄'"
      class="history"
      tabindex="-1"
    >
      @if (readOnly()) {
        <p role="status">目前為唯讀資料，連線並更新後才能操作。</p>
      }
      @if (error()) {
        <app-read-error [message]="error()!" [pending]="pending()" (retry)="load(failedMore)" />
      }
      @if (pending()) {
        <p role="status">載入中…</p>
      }
      @if (!pending() && !error() && !cursor() && rows().length === 0) {
        <p>尚無異動紀錄。</p>
      }
      <ol role="list">
        @for (m of rows(); track m.id) {
          <li>
            @if (!usageAdventureEntryId()) {
              @let day = (m.createdAt | date: 'yyyy/MM/dd');
              @if ($first || day !== (rows()[$index - 1].createdAt | date: 'yyyy/MM/dd')) {
                <h3 class="day-group">{{ day }}</h3>
              }
            }
            <div class="movement-card" [class.has-actions]="m.operation === 'CONSUME' && !m.reversed">
              <details>
                <summary>
                  <span class="summary-content">
                    <strong class="item-name">{{ m.itemName }}</strong>
                    <span class="movement">
                      <span class="operation" [class.consumed]="m.operation === 'CONSUME'">{{
                        labels[m.operation]
                      }}</span>
                      <strong>
                        {{ m.quantityDelta > 0 ? '+' : '' }}{{ m.quantityDelta }} 個
                      </strong>
                    </span>
                  </span>
                  <svg lucideChevronDown [size]="18" aria-hidden="true"></svg>
                </summary>
                <div class="movement-detail">
                  @if (!usageAdventureEntryId()) {
                    <dl class="balances">
                      <div><dt>原有</dt><dd>{{ m.quantityBefore }} 個</dd></div>
                      <div><dt>剩餘</dt><dd>{{ m.quantityAfter }} 個</dd></div>
                    </dl>
                  }
                  <p class="context">
                    取得來源：{{
                      m.sourceName || m.sourceCode
                        ? (m.sourceName || '') + ' ' + (m.sourceCode || '')
                        : '—'
                    }}
                  </p>
                  @if (!usageAdventureEntryId() && m.operation === 'CONSUME') {
                    <p class="context">
                      使用冒險：
                      @if (m.usageEntryId) {
                        <a [routerLink]="['/characters', characterId(), 'adventures', m.usageEntryId]">{{
                          m.usageName || m.usageCode || '冒險紀錄'
                        }}</a>
                      } @else if (m.usageOriginalEntryId) {
                        {{ m.usageName }} {{ m.usageCode }} · 關聯冒險已刪除。
                      } @else {
                        未指定
                      }
                    </p>
                  }
                  @if (!usageAdventureEntryId()) {
                    <p class="context">
                      <time [attr.datetime]="m.createdAt">記錄於 {{ m.createdAt | date: 'yyyy/MM/dd HH:mm:ss' }}</time>
                    </p>
                  }
                  @if (m.notes?.trim()) {
                    <p class="notes">{{ m.notes }}</p>
                  }
                  @if (m.operation === 'CONSUME' && !m.reversed && !m.reversible) {
                    <p class="context">此物品已有後續異動或已移除，無法直接撤銷。請至倉庫調整數量。</p>
                  }
                </div>
              </details>
              @if (m.operation === 'CONSUME' && !m.reversed) {
                <button
                  mat-icon-button
                  type="button"
                  class="record-menu"
                  [matMenuTriggerFor]="recordActions"
                  [matMenuTriggerData]="{ movement: m }"
                  [disabled]="readOnly() || busy()"
                  [attr.aria-label]="m.itemName + '的紀錄操作'"
                >
                  <svg lucideEllipsis [size]="20" aria-hidden="true"></svg>
                </button>
              }
            </div>
          </li>
        }
      </ol>
      <mat-menu #recordActions="matMenu">
        <ng-template matMenuContent let-movement="movement">
          <button mat-menu-item type="button" (click)="editUsage(movement)" [disabled]="readOnly() || busy()">編輯</button>
          <button mat-menu-item type="button" (click)="reverse(movement)" [disabled]="readOnly() || busy() || !movement.reversible">撤銷消耗</button>
        </ng-template>
      </mat-menu>
      @if (cursor() && !error()) {
        <button mat-stroked-button (click)="load(true)" [disabled]="pending()">載入更多</button>
      }
    </section>
  `,
  styles: `
    .history {
      padding-block: 1rem;
    }
    ol {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .day-group {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin: 0.5rem 0;
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.875rem;
      font-weight: 600;
    }
    .day-group::after {
      content: '';
      flex: 1;
      border-block-start: 1px solid var(--mat-sys-outline-variant);
    }
    .movement-card {
      position: relative;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--radius-md);
      background: var(--mat-sys-surface-container-low);
      overflow-wrap: anywhere;
    }
    summary {
      position: relative;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      min-height: 52px;
      padding: 8px 44px 8px 14px;
      border-radius: var(--radius-md);
      cursor: pointer;
      list-style: none;
    }
    summary::-webkit-details-marker {
      display: none;
    }
    summary:hover {
      background: var(--mat-sys-surface-container);
    }
    summary:focus-visible {
      outline: 2px solid var(--mat-sys-primary);
      outline-offset: -2px;
    }
    .has-actions summary {
      padding-inline-end: 92px;
    }
    .summary-content {
      display: flex;
      flex: 1;
      align-items: center;
      justify-content: space-between;
      gap: 0.25rem 1rem;
      min-width: 0;
    }
    summary svg {
      position: absolute;
      inset-block-start: 17px;
      inset-inline-end: 12px;
      color: var(--mat-sys-on-surface-variant);
    }
    details[open] summary svg {
      transform: rotate(180deg);
    }
    .movement {
      display: flex;
      flex: none;
      align-items: center;
      gap: 0.5rem;
      font-variant-numeric: tabular-nums;
    }
    .operation {
      padding: 0.2rem 0.6rem;
      border-radius: 1rem;
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
      font-size: 0.8rem;
    }
    .operation.consumed {
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
    }
    .record-menu {
      position: absolute;
      inset-block-start: 4px;
      inset-inline-end: 40px;
      width: 44px;
      min-width: 44px;
      height: 44px;
    }
    .record-menu:not(:disabled) {
      color: var(--mat-sys-on-surface-variant);
    }
    .movement-detail {
      margin-inline: 14px;
      padding-block: 0.625rem;
      border-top: 1px solid var(--mat-sys-outline-variant);
    }
    .balances {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem 1.5rem;
      margin: 0 0 0.5rem;
    }
    .balances div {
      display: flex;
      align-items: baseline;
      gap: 0.5rem;
    }
    dt, .context {
      color: var(--mat-sys-on-surface-variant);
      font-size: 0.875rem;
    }
    dd {
      margin: 0;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .movement-detail p {
      margin: 0.375rem 0;
    }
    a {
      color: var(--mat-sys-primary);
    }
    .notes {
      white-space: pre-wrap;
    }
    button {
      min-height: 44px;
    }
    @media (max-width: 600px) {
      .summary-content {
        flex-direction: column;
        align-items: flex-start;
      }
      .movement {
        flex-wrap: wrap;
        flex: 0 1 auto;
        max-width: 100%;
      }
    }
  `,
})
export class InventoryHistoryComponent implements OnChanges {
  readonly characterId = input.required<string>();
  readonly readOnly = input(true);
  readonly usageAdventureEntryId = input<string>();
  private readonly local = inject(LocalStore);
  private readonly service = inject(InventoryService);
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  private readonly destroy = inject(DestroyRef);
  private readonly watcher = watchReadPage(() => {
    if (this.initialized) this.load();
  });
  private initialized = false;
  private generation = 0;
  readonly rows = signal<InventoryMovement[]>([]);
  readonly cursor = signal<string | null>(null);
  readonly pending = signal(false);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  failedMore = false;
  readonly labels = {
    BASELINE: '起始庫存',
    ACQUIRE: '取得',
    ADJUST: '調整',
    CONSUME: '消耗',
    REMOVE: '移除',
    REVERSE: '撤銷',
  };

  constructor() {
    this.local.sessionChanged.pipe(takeUntilDestroyed(this.destroy)).subscribe(() => {
      ++this.generation;
      this.rows.set([]);
      this.cursor.set(null);
      this.pending.set(false);
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['characterId'] || changes['usageAdventureEntryId']) {
      this.initialized = true;
      this.rows.set([]);
      this.cursor.set(null);
      this.load();
    }
  }

  load(more = false): void {
    const generation = ++this.generation;
    this.failedMore = more;
    if (!more) this.cursor.set(null);
    this.pending.set(true);
    this.error.set(null);
    const entryId = this.usageAdventureEntryId();
    const request = entryId
      ? this.service.movements(this.characterId(), more ? this.cursor() : null, true, {
          usageAdventureEntryId: entryId,
          reversed: false,
        })
      : this.service.movements(this.characterId(), more ? this.cursor() : null, true);
    request.pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (page) => {
        if (generation !== this.generation) return;
        const visible = page.items.filter(
          (m) => !m.reversed && m.operation !== 'REVERSE' && m.operation !== 'BASELINE',
        );
        this.rows.set(more ? [...this.rows(), ...visible] : visible);
        this.cursor.set(page.nextCursor);
        this.pending.set(false);
      },
      error: (error) => {
        if (generation !== this.generation) return;
        if ([401, 403, 404].includes(error.status)) {
          this.rows.set([]);
          this.cursor.set(null);
        }
        this.error.set(readErrorMessage(error, '倉庫'));
        this.pending.set(false);
      },
      complete: () => {
        if (generation === this.generation) this.pending.set(false);
      },
    });
  }

  editUsage(movement: InventoryMovement): void {
    if (this.readOnly() || this.busy() || movement.reversed) return;
    const characterId = this.characterId(),
      entryId = this.usageAdventureEntryId(),
      owner = this.local.owner();
    const sameContext = () =>
      !this.destroy.destroyed &&
      characterId === this.characterId() &&
      entryId === this.usageAdventureEntryId() &&
      owner === this.local.owner();
    this.dialog
      .open(InventoryConsumeDialogComponent, {
        width: '480px',
        maxWidth: '95vw',
        data: { characterId, movement, canWrite: () => sameContext() && !this.readOnly() },
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe((saved) => {
        if (saved && sameContext()) {
          this.snack.open('已更新消耗紀錄。', '關閉', { duration: 2500 });
          this.load();
          this.focusHistory();
        }
      });
  }

  reverse(movement: InventoryMovement): void {
    if (this.readOnly() || this.busy() || !movement.reversible || movement.reversed) return;
    const characterId = this.characterId(),
      entryId = this.usageAdventureEntryId(),
      owner = this.local.owner();
    const sameContext = () =>
      !this.destroy.destroyed &&
      characterId === this.characterId() &&
      entryId === this.usageAdventureEntryId() &&
      owner === this.local.owner();
    this.dialog
      .open(ConfirmDialogComponent, {
        width: '400px',
        data: {
          title: '撤銷消耗',
          confirmText: '撤銷消耗',
          message: '撤銷後會補回本次消耗數量，並從畫面移除這次登記。是否繼續？',
        },
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe((confirmed) => {
        if (!confirmed || !sameContext() || this.readOnly() || this.busy()) return;
        this.busy.set(true);
        this.error.set(null);
        this.service
          .reverse(characterId, movement)
          .pipe(takeUntilDestroyed(this.destroy))
          .subscribe({
            next: () => {
              if (!sameContext()) return;
              this.busy.set(false);
              this.snack.open('已撤銷消耗。', '關閉', { duration: 2500 });
              this.load();
              this.focusHistory();
            },
            error: (error) => {
              this.busy.set(false);
              if (sameContext()) this.error.set(error.error?.message || '儲存失敗');
            },
            complete: () => this.busy.set(false),
          });
      });
  }

  private focusHistory(): void {
    this.element.nativeElement.querySelector<HTMLElement>('.history')?.focus();
  }
}
