import { TestBed } from '@angular/core/testing';
import { AdventureDraftInput } from '../models/adventure-draft';
import { AdventureDraftSession } from './adventure-draft-session';
import { DraftConflict, LocalStore } from './local-store.service';

const blank: AdventureDraftInput = {
  form: { playDate: '2026-10-12', adventureNotes: '' },
  levelUp: false,
  catchup: false,
  catchupCount: 1,
  classes: [{ className: 'Fighter', level: 1 }],
  magicItems: [],
  consumables: [],
  awards: [],
  activities: [],
};
describe('Adventure draft lifecycle', () => {
  let local: LocalStore;
  let draft: AdventureDraftSession;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [AdventureDraftSession] });
    local = TestBed.inject(LocalStore);
    local.setOwner('a');
    vi.spyOn(local, 'getDraft').mockResolvedValue(undefined);
    vi.spyOn(local, 'putDraft').mockImplementation(async (characterId, target, data, revision) => ({
      key: target,
      ownerId: 'a',
      characterId,
      schemaVersion: 1,
      savedAt: Date.now(),
      revision: revision + 1,
      data,
    }));
    vi.spyOn(local, 'deleteDraft').mockResolvedValue();
    draft = TestBed.inject(AdventureDraftSession);
  });
  it('does not save initialization, but preserves incomplete soul-coin details', async () => {
    await draft.start('c', 'new');
    draft.cloudLoaded(null, blank);
    draft.capture(blank);
    await draft.flush();
    expect(local.putDraft).not.toHaveBeenCalled();
    const input = {
      ...blank,
      consumables: [
        {
          itemName: '',
          quantity: 2,
          isSoulCoin: true,
          rarity: '',
          itemCategory: '',
          notes: 'unfinished',
        },
      ],
    };
    draft.capture(input);
    await draft.flush();
    expect(local.putDraft).toHaveBeenCalledWith('c', 'new', { input, baseline: null }, 0);
    expect(draft.status()).toContain('此裝置');
  });
  it('waits for draft lookup even when cloud defaults finish first', async () => {
    let finish!: (value: undefined) => void;
    vi.mocked(local.getDraft).mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const loading = draft.start('c', 'new');
    draft.cloudLoaded(null, blank);
    expect(draft.isReady()).toBe(false);
    draft.capture({ ...blank, awards: [{ awardName: 'early', description: '' }] });
    await draft.flush();
    expect(local.putDraft).not.toHaveBeenCalled();
    finish(undefined);
    await loading;
    expect(draft.isReady()).toBe(true);
  });
  it('protects offered drafts until recovery and rejects a changed cloud baseline', async () => {
    vi.mocked(local.getDraft).mockResolvedValue({
      key: 'k',
      ownerId: 'a',
      characterId: 'c',
      schemaVersion: 1,
      savedAt: 100,
      revision: 3,
      data: { input: blank, baseline: 'old' },
    });
    await draft.start('c', 'edit');
    draft.cloudLoaded('new', blank);
    draft.capture({ ...blank, awards: [{ awardName: 'new', description: '' }] });
    await draft.flush();
    expect(local.putDraft).not.toHaveBeenCalled();
    expect(draft.accept()).toBeUndefined();
    expect(draft.record()).toBeDefined();
  });
  it('serializes writes and clears only after cloud success', async () => {
    await draft.start('c', 'new');
    draft.cloudLoaded(null, blank);
    draft.capture({ ...blank, form: { ...blank.form, adventureNotes: 'first' } });
    const first = draft.flush();
    draft.capture({ ...blank, form: { ...blank.form, adventureNotes: 'second' } });
    const second = draft.flush();
    await Promise.all([first, second]);
    expect(vi.mocked(local.putDraft).mock.calls.map((call) => call[3])).toEqual([0, 1]);
    expect(local.deleteDraft).not.toHaveBeenCalled();
    expect(await draft.savedToCloud('saved')).toBe(true);
    expect(local.deleteDraft).toHaveBeenCalledWith('c', 'new', 3);
    draft.capture(blank);
    await draft.flush();
    expect(local.putDraft).toHaveBeenCalledTimes(3);
  });
  it('keeps current input on storage failure and stops conflicting tab overwrites', async () => {
    await draft.start('c', 'new');
    draft.cloudLoaded(null, blank);
    vi.mocked(local.putDraft)
      .mockRejectedValueOnce(new Error('quota'))
      .mockRejectedValueOnce(new DraftConflict());
    draft.capture({ ...blank, awards: [{ awardName: 'unfinished', description: '' }] });
    await draft.flush();
    expect(draft.error()).toContain('未保存');
    await draft.flush();
    expect(draft.error()).toContain('另一分頁');
    await draft.flush();
    expect(local.putDraft).toHaveBeenCalledTimes(2);
  });
  it('hides old account drafts and cancels pending debounce', async () => {
    await draft.start('c', 'new');
    draft.cloudLoaded(null, blank);
    draft.capture({ ...blank, form: { ...blank.form, adventureNotes: 'a' } });
    local.setOwner('b');
    await draft.flush();
    expect(local.putDraft).not.toHaveBeenCalled();
    expect(draft.record()).toBeUndefined();
  });
  it('preserves a completion marker when deleting the local draft fails', async () => {
    await draft.start('c', 'new');
    draft.cloudLoaded(null, blank);
    draft.capture({ ...blank, form: { ...blank.form, adventureNotes: 'done' } });
    await draft.flush();
    vi.mocked(local.deleteDraft).mockRejectedValue(new Error('blocked'));
    expect(await draft.savedToCloud('saved')).toBe(false);
    expect(vi.mocked(local.putDraft).mock.calls[1][2]).toMatchObject({ cloudSavedId: 'saved' });
    expect(draft.error()).toContain('雲端已儲存');
  });
});
