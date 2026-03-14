export type SafeUrlOptions = {
  allowedProtocols?: string[];
  allowedHosts?: string[];
  baseOrigin?: string;
};

export function safeExternalHref(raw: string | null | undefined, options: SafeUrlOptions = {}) {
  if (!raw) return null;

  const allowedProtocols = options.allowedProtocols ?? ['http:', 'https:'];
  const allowedHosts = options.allowedHosts?.map((host) => host.toLowerCase());
  const baseOrigin =
    options.baseOrigin ?? (typeof window !== 'undefined' ? window.location.origin : undefined);

  if (!baseOrigin) {
    return null;
  }

  try {
    const url = new URL(raw, baseOrigin);
    if (!allowedProtocols.includes(url.protocol)) return null;
    if (url.username || url.password) return null;
    if (allowedHosts && allowedHosts.length > 0 && !allowedHosts.includes(url.hostname.toLowerCase())) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

