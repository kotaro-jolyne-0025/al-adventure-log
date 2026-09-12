import {
  Component,
  ElementRef,
  Inject,
  OnInit,
  ViewChild,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatSliderModule } from '@angular/material/slider';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';

export interface AvatarCropperDialogData {
  imageSource: string | File;
}

@Component({
  selector: 'app-avatar-cropper-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatSliderModule,
    MatIconModule,
  ],
  template: `
    <div class="cropper-dialog">
      <h2 mat-dialog-title class="dialog-title">
        <mat-icon class="title-icon">crop</mat-icon>
        <span>裁切角色大頭照</span>
      </h2>

      <mat-dialog-content class="dialog-content">
        <p class="crop-hint">
          可拖曳圖片移動位置，或使用下方滑桿縮放大小以配合肖像框
        </p>

        <!-- Canvas Container -->
        <div class="canvas-wrapper">
          <canvas
            #cropCanvas
            width="320"
            height="320"
            (mousedown)="onMouseDown($event)"
            (mousemove)="onMouseMove($event)"
            (mouseup)="onMouseUp()"
            (mouseleave)="onMouseUp()"
            (touchstart)="onTouchStart($event)"
            (touchmove)="onTouchMove($event)"
            (touchend)="onTouchEnd()"
            (wheel)="onWheel($event)"
          ></canvas>
        </div>

        <!-- Controls Bar -->
        <div class="controls-row">
          <mat-icon class="zoom-icon">zoom_out</mat-icon>
          <mat-slider
            [min]="minScale()"
            [max]="maxScale()"
            [step]="0.01"
            class="zoom-slider"
          >
            <input
              matSliderThumb
              [ngModel]="scale()"
              (ngModelChange)="onScaleChange($event)"
            />
          </mat-slider>
          <mat-icon class="zoom-icon">zoom_in</mat-icon>
          <button
            mat-icon-button
            (click)="resetTransform()"
            matTooltip="重設位置與縮放"
            class="btn-reset"
          >
            <mat-icon>restart_alt</mat-icon>
          </button>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end" class="dialog-actions">
        <button mat-button mat-dialog-close>取消</button>
        <button
          mat-flat-button
          color="primary"
          (click)="onConfirm()"
          [disabled]="!imageLoaded()"
        >
          <mat-icon>check</mat-icon>
          <span>確認套用</span>
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [
    `
      .cropper-dialog {
        display: flex;
        flex-direction: column;
        user-select: none;
      }

      .dialog-title {
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 0;
        padding: 16px 24px 8px;
        font-size: 1.2rem;
        font-weight: 700;
        color: var(--text-primary);

        .title-icon {
          color: var(--color-primary);
          font-size: 1.3rem;
          width: 1.3rem;
          height: 1.3rem;
        }
      }

      .dialog-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 8px 24px 16px;
      }

      .crop-hint {
        font-size: 0.85rem;
        color: var(--text-muted);
        margin: 0 0 12px;
        text-align: center;
      }

      .canvas-wrapper {
        position: relative;
        width: 320px;
        height: 320px;
        border-radius: 12px;
        overflow: hidden;
        background: #0f172a;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
        cursor: grab;

        &:active {
          cursor: grabbing;
        }

        canvas {
          display: block;
          width: 320px;
          height: 320px;
        }
      }

      .controls-row {
        display: flex;
        align-items: center;
        width: 100%;
        max-width: 320px;
        gap: 8px;
        margin-top: 14px;

        .zoom-icon {
          color: var(--text-muted);
          font-size: 1.1rem;
          width: 1.1rem;
          height: 1.1rem;
        }

        .zoom-slider {
          flex: 1;
        }

        .btn-reset {
          color: var(--text-muted);
          &:hover {
            color: var(--text-primary);
          }
        }
      }

      .dialog-actions {
        padding: 8px 24px 16px;
        border-top: 1px solid var(--border-subtle);
      }
    `,
  ],
})
export class AvatarCropperDialogComponent implements OnInit {
  @ViewChild('cropCanvas', { static: true })
  private canvasRef!: ElementRef<HTMLCanvasElement>;

  protected imageLoaded = signal(false);
  protected scale = signal(1);
  protected minScale = signal(0.2);
  protected maxScale = signal(3.5);

  private img = new Image();
  private offsetX = 0;
  private offsetY = 0;
  private isDragging = false;
  private startDragX = 0;
  private startDragY = 0;

  // 裁切視窗配置 (在 320x320 畫布中置中 240x240 的圓角正方形)
  private readonly CANVAS_SIZE = 320;
  private readonly CROP_SIZE = 240;
  private readonly CROP_RADIUS = 16;
  private readonly CROP_X = (320 - 240) / 2; // 40
  private readonly CROP_Y = (320 - 240) / 2; // 40

  constructor(
    private dialogRef: MatDialogRef<AvatarCropperDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AvatarCropperDialogData
  ) {}

  ngOnInit(): void {
    this.loadImage(this.data.imageSource);
  }

  private loadImage(source: string | File): void {
    if (typeof source === 'string') {
      this.img.src = source;
      this.setupImageHandlers();
    } else if (source instanceof File) {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.img.src = e.target?.result as string;
        this.setupImageHandlers();
      };
      reader.readAsDataURL(source);
    }
  }

  private setupImageHandlers(): void {
    this.img.onload = () => {
      this.imageLoaded.set(true);
      // 計算初始縮放比例，使圖片最短邊符合裁切框
      const fitScale = Math.max(
        this.CROP_SIZE / this.img.width,
        this.CROP_SIZE / this.img.height
      );
      this.minScale.set(Math.max(0.1, fitScale * 0.5));
      this.maxScale.set(Math.max(3.0, fitScale * 4));
      this.scale.set(fitScale);
      this.resetTransform();
    };
  }

  protected resetTransform(): void {
    const s = this.scale();
    // 預設將圖片中心置於裁切框中心
    this.offsetX = (this.CANVAS_SIZE - this.img.width * s) / 2;
    this.offsetY = (this.CANVAS_SIZE - this.img.height * s) / 2;
    this.draw();
  }

  protected onScaleChange(newScale: number): void {
    const prevScale = this.scale();
    if (prevScale === newScale) return;

    // 以裁切框中心 (160, 160) 為中心進行縮放
    const centerX = this.CANVAS_SIZE / 2;
    const centerY = this.CANVAS_SIZE / 2;

    const imgX = (centerX - this.offsetX) / prevScale;
    const imgY = (centerY - this.offsetY) / prevScale;

    this.scale.set(newScale);
    this.offsetX = centerX - imgX * newScale;
    this.offsetY = centerY - imgY * newScale;

    this.draw();
  }

  protected onMouseDown(e: MouseEvent): void {
    this.isDragging = true;
    this.startDragX = e.clientX - this.offsetX;
    this.startDragY = e.clientY - this.offsetY;
  }

  protected onMouseMove(e: MouseEvent): void {
    if (!this.isDragging) return;
    this.offsetX = e.clientX - this.startDragX;
    this.offsetY = e.clientY - this.startDragY;
    this.draw();
  }

  protected onMouseUp(): void {
    this.isDragging = false;
  }

  protected onTouchStart(e: TouchEvent): void {
    if (e.touches.length === 1) {
      this.isDragging = true;
      this.startDragX = e.touches[0].clientX - this.offsetX;
      this.startDragY = e.touches[0].clientY - this.offsetY;
    }
  }

  protected onTouchMove(e: TouchEvent): void {
    if (!this.isDragging || e.touches.length !== 1) return;
    e.preventDefault();
    this.offsetX = e.touches[0].clientX - this.startDragX;
    this.offsetY = e.touches[0].clientY - this.startDragY;
    this.draw();
  }

  protected onTouchEnd(): void {
    this.isDragging = false;
  }

  protected onWheel(e: WheelEvent): void {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    const newScale = Math.min(
      this.maxScale(),
      Math.max(this.minScale(), this.scale() * zoomFactor)
    );
    this.onScaleChange(newScale);
  }

  private draw(): void {
    const canvas = this.canvasRef.nativeElement;
    const ctx = canvas.getContext('2d');
    if (!ctx || !this.imageLoaded()) return;

    // 清除畫布
    ctx.clearRect(0, 0, this.CANVAS_SIZE, this.CANVAS_SIZE);

    // 1. 繪製縮放平移後的底圖
    const s = this.scale();
    ctx.drawImage(
      this.img,
      this.offsetX,
      this.offsetY,
      this.img.width * s,
      this.img.height * s
    );

    // 2. 繪製半透明暗色遮罩（圓角正方形挖孔）
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
    ctx.beginPath();
    ctx.rect(0, 0, this.CANVAS_SIZE, this.CANVAS_SIZE);

    // 逆向挖出圓角正方形孔洞
    this.drawRoundedRectPath(
      ctx,
      this.CROP_X,
      this.CROP_Y,
      this.CROP_SIZE,
      this.CROP_SIZE,
      this.CROP_RADIUS
    );
    ctx.fill('evenodd');

    // 3. 繪製裁切框邊線
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    this.drawRoundedRectPath(
      ctx,
      this.CROP_X,
      this.CROP_Y,
      this.CROP_SIZE,
      this.CROP_SIZE,
      this.CROP_RADIUS
    );
    ctx.stroke();

    // 4. 繪製輔助十字中心線（淡淡的）
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    // 橫線
    ctx.moveTo(this.CROP_X, this.CANVAS_SIZE / 2);
    ctx.lineTo(this.CROP_X + this.CROP_SIZE, this.CANVAS_SIZE / 2);
    // 直線
    ctx.moveTo(this.CANVAS_SIZE / 2, this.CROP_Y);
    ctx.lineTo(this.CANVAS_SIZE / 2, this.CROP_Y + this.CROP_SIZE);
    ctx.stroke();

    ctx.restore();
  }

  private drawRoundedRectPath(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  protected onConfirm(): void {
    if (!this.imageLoaded()) return;

    // 輸出 300x300 正方形圖片
    const outputSize = 300;
    const outCanvas = document.createElement('canvas');
    outCanvas.width = outputSize;
    outCanvas.height = outputSize;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) return;

    const s = this.scale();
    // 計算裁切框在原圖上的對應座標 (sx, sy, sw, sh)
    const sx = (this.CROP_X - this.offsetX) / s;
    const sy = (this.CROP_Y - this.offsetY) / s;
    const sw = this.CROP_SIZE / s;
    const sh = this.CROP_SIZE / s;

    outCtx.drawImage(
      this.img,
      sx,
      sy,
      sw,
      sh,
      0,
      0,
      outputSize,
      outputSize
    );

    // 優先匯出 WebP (quality 0.88)，若瀏覽器不支援會自動 fallback 為 image/png
    let resultDataUrl = outCanvas.toDataURL('image/webp', 0.88);
    if (!resultDataUrl.startsWith('data:image/webp')) {
      resultDataUrl = outCanvas.toDataURL('image/jpeg', 0.88);
    }

    this.dialogRef.close(resultDataUrl);
  }
}
