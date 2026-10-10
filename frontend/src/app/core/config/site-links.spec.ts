import { validSponsorshipUrl } from './site-links';

describe('sponsorship destination', () => {
  it.each([undefined, '', '/support', 'invalid', 'http://example.invalid',
    'javascript:alert(1)', 'https://user:password@example.invalid'])('hides invalid destination %s', value => {
    expect(validSponsorshipUrl(value)).toBeNull();
  });

  it('preserves a valid external destination', () => {
    expect(validSponsorshipUrl('https://example.invalid/support')).toBe('https://example.invalid/support');
  });
});
