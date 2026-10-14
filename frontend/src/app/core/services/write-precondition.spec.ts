import { versionHeader, writeRequest } from './write-precondition';

describe('Write preconditions', () => {
  it('preserves all six timestamp digits in the header and strips metadata from the body', () => {
    const timestamp = '2026-10-14T01:02:03.123456';
    const original = { expectedUpdatedAt: timestamp, itemName: 'Sword', quantity: 2 };
    expect(writeRequest(original)).toEqual({
      body: { itemName: 'Sword', quantity: 2 },
      options: { headers: { 'X-Expected-Updated-At': timestamp } },
    });
    expect(original.expectedUpdatedAt).toBe(timestamp);
  });

  it('leaves a missing legacy token missing instead of manufacturing a new version', () => {
    expect(versionHeader().headers['X-Expected-Updated-At']).toBe('');
    expect(writeRequest({ expectedUpdatedAt: undefined, itemName: 'Sword' }).body)
      .toEqual({ itemName: 'Sword' });
  });
});
