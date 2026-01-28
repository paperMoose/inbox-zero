import { extractDomain } from './parse.js';

/**
 * Canonical list of domains that should never be aggressively filtered.
 * This is the single source of truth — all modules import from here.
 */
export const PROTECTED_DOMAINS = [
  // Banking / Financial
  'chase.com',
  'capitalone.com',
  'citi.com',
  'amex.com',
  'americanexpress.com',
  'wellsfargo.com',
  'bankofamerica.com',
  'paypal.com',
  'venmo.com',
  'mercury.com',
  'coinbase.com',
  'robinhood.com',
  // Work / HR
  'rippling.com',
  // Services
  'google.com',
  'github.com',
  'apple.com',
  // Travel
  'united.com',
  'delta.com',
  'southwest.com',
  'aa.com',
  // Delivery
  'uber.com',
  'lyft.com',
  'doordash.com',
  // Healthcare
  'sutterhealth.org',
];

/**
 * Check whether `domain` matches a protected domain using proper suffix matching.
 * "mail.chase.com" matches "chase.com", but "notchase.com" does NOT.
 */
export function domainMatchesProtected(domain, protectedDomain) {
  return domain === protectedDomain || domain.endsWith('.' + protectedDomain);
}

/**
 * Is the email from a hardcoded protected domain?
 */
export function isFromProtectedDomain(email) {
  const domain = extractDomain(email);
  if (!domain) return false;
  return PROTECTED_DOMAINS.some(pd => domainMatchesProtected(domain, pd));
}

/**
 * Is the email a protected sender?
 * Checks both the env-configured protectedSenders list AND the hardcoded domain list.
 *
 * protectedSenders entries can be:
 *   - full email: "alerts@chase.com"
 *   - @domain:    "@chase.com"
 *   - bare domain: "chase.com"
 */
export function isProtected(email, protectedSenders = []) {
  if (isFromProtectedDomain(email)) return true;

  const emailLower = email.toLowerCase();
  const domain = extractDomain(emailLower);

  return protectedSenders.some(raw => {
    const s = raw.toLowerCase().trim();

    // Exact email match
    if (emailLower === s) return true;

    // @domain form
    if (s.startsWith('@')) {
      const sd = s.slice(1);
      return domainMatchesProtected(domain, sd);
    }

    // Bare domain (no @)
    if (!s.includes('@')) {
      return domainMatchesProtected(domain, s);
    }

    // Sender is a full email — compare domains
    const sd = extractDomain(s);
    return sd && domain === sd;
  });
}
