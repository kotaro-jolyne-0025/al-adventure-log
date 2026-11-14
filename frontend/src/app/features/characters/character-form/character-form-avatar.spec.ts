import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { of } from 'rxjs';
import { CharacterService } from '../../../core/services/character.service';
import { AuthService } from '../../../core/services/auth.service';
import { CharacterFormComponent } from './character-form.component';

const { convert } = vi.hoisted(() => ({ convert: vi.fn() }));
vi.mock('heic-to', () => ({ heicTo: convert }));

describe('Character form native-first HEIC upload', () => {
  let component: CharacterFormComponent;
  let open: ReturnType<typeof vi.fn>;
  let notify: ReturnType<typeof vi.fn>;
  let decode: ReturnType<typeof vi.fn>;
  let revoke: ReturnType<typeof vi.fn<(url: string) => void>>;

  beforeEach(() => {
    convert.mockReset().mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' }));
    decode = vi.fn().mockResolvedValue(undefined);
    revoke = vi.fn();
    vi.stubGlobal('Image', class {
      src = '';
      naturalWidth = 300;
      naturalHeight = 300;
      decode = decode;
      removeAttribute() { this.src = ''; }
    });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:avatar');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(url => { revoke(url); });
    open = vi.fn(() => ({ afterClosed: () => of(undefined) }));
    notify = vi.fn();
    TestBed.configureTestingModule({ providers: [
      { provide: ActivatedRoute, useValue: {} },
      { provide: Router, useValue: {} },
      { provide: CharacterService, useValue: {} },
      { provide: AuthService, useValue: {} },
      { provide: MatDialog, useValue: { open } },
      { provide: MatSnackBar, useValue: { open: notify } },
    ] });
    component = TestBed.runInInjectionContext(() => new CharacterFormComponent());
    component['avatarUrl'].set('existing-avatar');
  });

  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  function selection(name = 'photo.heic', type = 'image/heic') {
    const file = new File(['photo'], name, { type });
    const input = { files: [file], value: name };
    return { file, input, event: { target: input } as unknown as Event };
  }

  it('passes the original file to the cropper when native decoding succeeds', async () => {
    const { file, input, event } = selection();
    await component['onAvatarFileSelected'](event);
    expect(open).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ data: { imageSource: file } }));
    expect(convert).not.toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledWith('blob:avatar');
    expect(input.value).toBe('');
    expect(component['isProcessingAvatar']()).toBe(false);
    expect(component['avatarUrl']()).toBe('existing-avatar');
  });

  it('converts to JPEG only after native decoding fails, including empty MIME HEIF files', async () => {
    decode.mockRejectedValue(new Error('unsupported'));
    const { file, event } = selection('photo.HEIF', '');
    await component['onAvatarFileSelected'](event);
    expect(convert).toHaveBeenCalledWith({ blob: file, type: 'image/jpeg', quality: 0.92 });
    expect(open.mock.calls[0][1].data.imageSource.type).toBe('image/jpeg');
    expect(revoke).toHaveBeenCalledOnce();
  });

  it('keeps the old avatar and resets selection after conversion failure', async () => {
    decode.mockRejectedValue(new Error('unsupported'));
    convert.mockRejectedValue(new Error('invalid file'));
    const { input, event } = selection();
    await component['onAvatarFileSelected'](event);
    expect(open).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith('無法讀取這張照片，請確認格式後再試一次', '關閉', expect.anything());
    expect(component['avatarUrl']()).toBe('existing-avatar');
    expect(component['isProcessingAvatar']()).toBe(false);
    expect(input.value).toBe('');
  });

  it('blocks duplicate selection and ignores decoding after leaving the page', async () => {
    let finish!: () => void;
    decode.mockReturnValue(new Promise<void>(resolve => { finish = resolve; }));
    const pending = component['onAvatarFileSelected'](selection().event);
    await component['onAvatarFileSelected'](selection().event);
    expect(decode).toHaveBeenCalledOnce();
    TestBed.resetTestingModule();
    finish();
    await pending;
    expect(open).not.toHaveBeenCalled();
    expect(convert).not.toHaveBeenCalled();
    expect(revoke).toHaveBeenCalledOnce();
  });

  it.each([false, true])('ignores conversion completion after leaving (failure: %s)', async fail => {
    decode.mockRejectedValue(new Error('unsupported'));
    convert.mockImplementation(async () => {
      TestBed.resetTestingModule();
      if (fail) throw new Error('conversion failed');
      return new Blob(['jpeg']);
    });
    await component['onAvatarFileSelected'](selection().event);
    expect(open).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });

  it('keeps normal JPEG selection immediate', async () => {
    await component['onAvatarFileSelected'](selection('photo.jpg', 'image/jpeg').event);
    expect(open).toHaveBeenCalledOnce();
    expect(decode).not.toHaveBeenCalled();
    expect(convert).not.toHaveBeenCalled();
  });

  it('rejects oversized files before decoding', async () => {
    const { file, event } = selection();
    Object.defineProperty(file, 'size', { value: 5 * 1024 * 1024 + 1 });
    await component['onAvatarFileSelected'](event);
    expect(decode).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith('圖片檔案過大，請選擇 5MB 以下的圖片', '關閉', expect.anything());
  });
});
