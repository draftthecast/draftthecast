// Share the sign-in cookie between draftthecast.com and www.draftthecast.com,
// so sign-in works whichever address someone starts on. Other hosts
// (localhost, Vercel preview URLs) keep the default host-only cookie.
export const SITE_DOMAIN = "draftthecast.com";

export function cookieOptionsFor(hostname: string | null | undefined) {
  const host = (hostname ?? "").split(":")[0].toLowerCase();
  return host === SITE_DOMAIN || host.endsWith(`.${SITE_DOMAIN}`) ? { domain: `.${SITE_DOMAIN}` } : undefined;
}
