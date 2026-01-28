/**
 * Extract email address from a "From" header value.
 * e.g. "John Doe <john@example.com>" -> "john@example.com"
 */
export function extractEmail(fromField) {
  if (!fromField) return '';
  const match = fromField.match(/<(.+?)>/) || fromField.match(/([^\s]+@[^\s]+)/);
  return match ? match[1].toLowerCase() : fromField.toLowerCase().trim();
}

/**
 * Extract domain from an email address.
 * e.g. "john@sub.example.com" -> "sub.example.com"
 */
export function extractDomain(email) {
  const match = email.match(/@([^>\s]+)/);
  return match ? match[1].toLowerCase() : '';
}

/**
 * Parse Gmail message headers array into a plain object keyed by lowercase name.
 */
export function parseHeaders(headersArray) {
  const out = {};
  if (!headersArray) return out;
  for (const h of headersArray) {
    out[h.name.toLowerCase()] = h.value;
  }
  return out;
}
