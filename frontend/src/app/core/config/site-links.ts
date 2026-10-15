export function validSponsorshipUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password
      ? url.href : null;
  } catch {
    return null;
  }
}

export const siteLinks = {
  contactEmail: 'adventurelog-contact.cupping865@simplelogin.com',
  sponsorshipUrl: validSponsorshipUrl('https://portaly.cc/kiranfreedom'),
};
