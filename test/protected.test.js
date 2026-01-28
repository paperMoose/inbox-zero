import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PROTECTED_DOMAINS, domainMatchesProtected, isFromProtectedDomain, isProtected } from '../src/lib/protected.js';

describe('domainMatchesProtected', () => {
  it('exact match', () => {
    assert.ok(domainMatchesProtected('chase.com', 'chase.com'));
  });

  it('subdomain match', () => {
    assert.ok(domainMatchesProtected('mail.chase.com', 'chase.com'));
  });

  it('does NOT match notchase.com (bug #4 regression)', () => {
    assert.ok(!domainMatchesProtected('notchase.com', 'chase.com'));
  });

  it('does NOT match achase.com', () => {
    assert.ok(!domainMatchesProtected('achase.com', 'chase.com'));
  });
});

describe('isFromProtectedDomain', () => {
  it('returns true for hardcoded domain', () => {
    assert.ok(isFromProtectedDomain('alerts@chase.com'));
  });

  it('returns true for subdomain of hardcoded domain', () => {
    assert.ok(isFromProtectedDomain('alerts@info.paypal.com'));
  });

  it('returns false for unknown domain', () => {
    assert.ok(!isFromProtectedDomain('spam@randomsite.com'));
  });

  it('returns false for similar but non-matching domain', () => {
    assert.ok(!isFromProtectedDomain('user@notchase.com'));
  });
});

describe('isProtected', () => {
  it('matches hardcoded domain with no extra senders', () => {
    assert.ok(isProtected('user@chase.com'));
  });

  it('matches env-configured exact email', () => {
    assert.ok(isProtected('doctor@clinic.org', ['doctor@clinic.org']));
  });

  it('matches env-configured @domain', () => {
    assert.ok(isProtected('billing@clinic.org', ['@clinic.org']));
  });

  it('matches env-configured bare domain', () => {
    assert.ok(isProtected('billing@clinic.org', ['clinic.org']));
  });

  it('matches subdomain of env-configured bare domain', () => {
    assert.ok(isProtected('billing@mail.clinic.org', ['clinic.org']));
  });

  it('does NOT false-positive on similar domain', () => {
    assert.ok(!isProtected('user@notclinic.org', ['clinic.org']));
  });

  it('returns false for empty senders and non-hardcoded domain', () => {
    assert.ok(!isProtected('user@randomsite.com', []));
  });

  it('combines hardcoded domains and env senders', () => {
    // hardcoded domain
    assert.ok(isProtected('user@paypal.com', ['custom@example.com']));
    // env sender
    assert.ok(isProtected('custom@example.com', ['custom@example.com']));
  });
});

describe('PROTECTED_DOMAINS', () => {
  it('is a non-empty array of strings', () => {
    assert.ok(Array.isArray(PROTECTED_DOMAINS));
    assert.ok(PROTECTED_DOMAINS.length > 0);
    PROTECTED_DOMAINS.forEach(d => assert.equal(typeof d, 'string'));
  });
});
