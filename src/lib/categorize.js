/**
 * Pure categorization function — no I/O, no side effects.
 *
 * Check order (fixes bug #1: receipts/confirmations now precede newsletter):
 *  1. VIP
 *  2. Protected sender
 *  3. Protected keyword
 *  4. Receipt
 *  5. Confirmation
 *  6. Newsletter
 *  7. Promotional
 *  8. Social
 *  9. Forums
 * 10. Automated
 * 11. Unknown
 *
 * @param {object}   opts
 * @param {string}   opts.fromEmail       — lowercased sender email
 * @param {string}   opts.subject         — raw subject line
 * @param {string[]} opts.labelIds        — Gmail label IDs on the message
 * @param {object}   opts.headers         — parsed headers (lowercase keys)
 * @param {string[]} opts.vipEmails       — lowercased VIP emails
 * @param {function} opts.isProtectedFn   — (email) => boolean
 * @param {string[]} opts.protectedKeywords — lowercased keywords
 * @returns {string} category name
 */
export function categorizeEmail({
  fromEmail,
  subject,
  labelIds,
  headers,
  vipEmails,
  isProtectedFn,
  protectedKeywords,
}) {
  const subjectLower = subject.toLowerCase();

  // 1. VIP
  if (vipEmails.includes(fromEmail)) return 'vip';

  // 2. Protected sender (domain + env list)
  if (isProtectedFn(fromEmail)) return 'protected';

  // 3. Protected keyword in subject
  if (protectedKeywords.some(kw => subjectLower.includes(kw))) return 'protected';

  // 4. Receipt — checked BEFORE newsletter so a receipt with List-Unsubscribe stays a receipt
  if (isReceipt(fromEmail, subjectLower)) return 'receipt';

  // 5. Confirmation
  if (isConfirmation(subjectLower)) return 'confirmation';

  // 6. Newsletter (header-based + subject patterns)
  if (headers['list-unsubscribe'] || headers['list-id']) return 'newsletter';
  if (NEWSLETTER_SUBJECT_RE.test(subject)) return 'newsletter';

  // 7. Promotional (Gmail category)
  if (labelIds.includes('CATEGORY_PROMOTIONS')) return 'promotional';

  // 8. Social
  if (labelIds.includes('CATEGORY_SOCIAL')) return 'social';

  // 9. Forums
  if (labelIds.includes('CATEGORY_FORUMS')) return 'forums';

  // 10. Automated sender patterns
  if (AUTOMATED_RE.test(fromEmail)) return 'automated';

  // 11. Fallback
  return 'unknown';
}

// --- internal helpers ---

const RECEIPT_SUBJECT_RE = /receipt|payment|invoice|charged|your purchase|order.*shipped|order.*delivered/i;

function isReceipt(fromEmail, subjectLower) {
  if (RECEIPT_SUBJECT_RE.test(subjectLower)) return true;
  if (fromEmail.includes('paypal.com')) return true;
  if (fromEmail.includes('invoice')) return true;
  if (fromEmail.includes('amazon.com')) return true;
  return false;
}

const CONFIRMATION_RE = /confirmation|confirmed|appointment|reservation|scheduled|registration/i;

function isConfirmation(subjectLower) {
  return CONFIRMATION_RE.test(subjectLower);
}

const NEWSLETTER_SUBJECT_RE = /newsletter|weekly digest|daily digest|update from|news from/i;

const AUTOMATED_RE = /noreply|no-reply|donotreply|automated|notification|alert|system/i;
