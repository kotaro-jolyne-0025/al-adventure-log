import { ElementRef } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { AvatarCropperDialogComponent } from './avatar-cropper-dialog.component';

describe('AvatarCropperDialogComponent responsive preview', () => {
  let component: AvatarCropperDialogComponent;
  let canvas: HTMLCanvasElement;
  let close: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    close = vi.fn();
    component = new AvatarCropperDialogComponent(
      { close } as unknown as MatDialogRef<AvatarCropperDialogComponent>,
      { imageSource: '' },
    );
    canvas = document.createElement('canvas');
    canvas.width = canvas.height = 320;
    component['canvasRef'] = new ElementRef(canvas);
    component['offsetX'] = 10;
    component['offsetY'] = 15;
    vi.spyOn(component as unknown as { draw(): void }, 'draw').mockImplementation(() => {});
  });

  afterEach(() => vi.restoreAllMocks());

  function preview(width: number): void {
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 20, top: 30, width, height: width,
    } as DOMRect);
  }

  it.each([160, 240, 320])('maps mouse movement in a %ipx preview to canvas coordinates', (width) => {
    preview(width);
    component['onMouseDown'](new MouseEvent('mousedown', { clientX: 40, clientY: 50 }));
    component['onMouseMove'](new MouseEvent('mousemove', { clientX: 48, clientY: 56 }));
    expect(component['offsetX']).toBeCloseTo(10 + 8 * 320 / width);
    expect(component['offsetY']).toBeCloseTo(15 + 6 * 320 / width);
    component['onMouseUp']();
    component['onMouseMove'](new MouseEvent('mousemove', { clientX: 80, clientY: 90 }));
    expect(component['offsetX']).toBeCloseTo(10 + 8 * 320 / width);
  });

  it('scales single-touch movement and stops after touch end or cancellation', () => {
    preview(160);
    component['onTouchStart']({ touches: [{ clientX: 40, clientY: 50 }] } as unknown as TouchEvent);
    const preventDefault = vi.fn();
    component['onTouchMove']({
      touches: [{ clientX: 48, clientY: 56 }], preventDefault,
    } as unknown as TouchEvent);
    expect(preventDefault).toHaveBeenCalled();
    expect(component['offsetX']).toBe(26);
    expect(component['offsetY']).toBe(27);
    component['onTouchEnd']();
    component['onTouchMove']({ touches: [{ clientX: 70, clientY: 80 }] } as unknown as TouchEvent);
    expect(component['offsetX']).toBe(26);
  });

  it('exports the preview crop at 300x300 after scaled dragging and zooming', () => {
    preview(160);
    component['onMouseDown'](new MouseEvent('mousedown', { clientX: 40, clientY: 50 }));
    component['onMouseMove'](new MouseEvent('mousemove', { clientX: 48, clientY: 56 }));
    component['onScaleChange'](2);
    component['imageLoaded'].set(true);
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ drawImage } as unknown as CanvasRenderingContext2D);
    let outputSize: number[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(function (this: HTMLCanvasElement) {
      outputSize = [this.width, this.height];
      return 'data:image/webp;base64,preview';
    });
    component['onConfirm']();
    expect(drawImage).toHaveBeenCalledWith(component['img'], 74, 73, 120, 120, 0, 0, 300, 300);
    expect(outputSize).toEqual([300, 300]);
    expect(close).toHaveBeenCalledWith('data:image/webp;base64,preview');
  });
});
