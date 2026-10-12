import { adventureBaseline, draftFormValues, isDraftInput } from './adventure-draft';

describe('Adventure draft adapter', () => {
  it('uses a local calendar date and retains incomplete raw fields', () => {
    expect(
      draftFormValues({
        playDate: new Date(2026, 9, 12),
        goldChange: '',
        adventureNotes: '  未完成  ',
      }),
    ).toEqual({ playDate: '2026-10-12', goldChange: '', adventureNotes: '  未完成  ' });
    expect(draftFormValues({ playDate: null })['playDate']).toBeNull();
  });
  it('ignores transport order and timestamps, but detects child and resource changes', () => {
    const before = {
      entry: { id: 'e', updatedAt: 'old', goldChange: 1 },
      gainedItems: [
        { id: 'a', quantity: 1, isSoulCoin: true },
        { id: 'b', acquisitionSource: 'DOWNTIME' },
      ],
    };
    expect(adventureBaseline(before)).toBe(
      adventureBaseline({
        gainedItems: [...before.gainedItems].reverse(),
        entry: { goldChange: 1, updatedAt: 'new', id: 'e' },
      }),
    );
    expect(adventureBaseline(before)).not.toBe(
      adventureBaseline({ ...before, gainedItems: [{ id: 'a', quantity: 2, isSoulCoin: true }] }),
    );
    expect(adventureBaseline(before)).not.toBe(
      adventureBaseline({ ...before, entry: { ...before.entry, goldChange: 2 } }),
    );
  });
  it('requires the complete draft structure rather than treating malformed content as empty', () => {
    expect(
      isDraftInput({
        form: {},
        levelUp: false,
        catchup: false,
        classes: [],
        magicItems: [],
        consumables: [],
        awards: [],
        activities: [],
      }),
    ).toBe(true);
    expect(isDraftInput({ form: {} })).toBe(false);
  });
});
