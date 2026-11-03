/** A source link is displayed in the browser; it must never be executable. */
export function safeExternalUrl(value) {
  if (
    typeof value !== 'string' ||
    !value ||
    value.length > 2048 ||
    value !== value.trim() ||
    /[\u0000-\u0020\u007f]/.test(value)
  )
    return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password
      ? value
      : null;
  } catch {
    return null;
  }
}
