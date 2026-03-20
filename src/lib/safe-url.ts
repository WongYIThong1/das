/**
 * Returns a safe external href that only allows http and https schemes.
 * Returns null if the input is falsy or uses a disallowed scheme (e.g. javascript:).
 */
export function safeExternalHref(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return url;
    }
    return null;
  } catch {
    return null;
  }
}
