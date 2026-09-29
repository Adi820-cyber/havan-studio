/** Return a normalized HTTPS URL safe to use as a user-provided link. */
export function safeHttpsUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return '';

  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) return '';
    return url.href;
  } catch {
    return '';
  }
}
