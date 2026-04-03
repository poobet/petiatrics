import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export const locales = ['en', 'th'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'th';

export default getRequestConfig(async () => {
  // Locale preference stored in session cookie (set by the API on login)
  // and optionally overridden by a standalone cookie on the web side.
  const cookieStore = await cookies();
  const rawLocale = cookieStore.get('petiatrics_locale')?.value;

  const locale: Locale =
    rawLocale && (locales as readonly string[]).includes(rawLocale.toLowerCase() as Locale)
      ? (rawLocale.toLowerCase() as Locale)
      : defaultLocale;

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
