import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extractEmail, extractDomain, parseHeaders } from '../src/lib/parse.js';

describe('extractEmail', () => {
  it('extracts email from angle brackets', () => {
    assert.equal(extractEmail('John Doe <john@example.com>'), 'john@example.com');
  });

  it('extracts bare email', () => {
    assert.equal(extractEmail('john@example.com'), 'john@example.com');
  });

  it('lowercases result', () => {
    assert.equal(extractEmail('John@Example.COM'), 'john@example.com');
  });

  it('returns empty string for null/undefined', () => {
    assert.equal(extractEmail(null), '');
    assert.equal(extractEmail(undefined), '');
    assert.equal(extractEmail(''), '');
  });

  it('handles display name with special chars', () => {
    assert.equal(extractEmail('"Doe, John" <john@example.com>'), 'john@example.com');
  });
});

describe('extractDomain', () => {
  it('extracts domain from email', () => {
    assert.equal(extractDomain('john@example.com'), 'example.com');
  });

  it('extracts subdomain', () => {
    assert.equal(extractDomain('john@sub.example.com'), 'sub.example.com');
  });

  it('returns empty string for invalid input', () => {
    assert.equal(extractDomain('nodomain'), '');
    assert.equal(extractDomain(''), '');
  });

  it('lowercases result', () => {
    assert.equal(extractDomain('john@Example.COM'), 'example.com');
  });
});

describe('parseHeaders', () => {
  it('converts header array to lowercase-keyed object', () => {
    const headers = [
      { name: 'From', value: 'john@example.com' },
      { name: 'Subject', value: 'Hello' },
      { name: 'List-Unsubscribe', value: '<http://unsub>' }
    ];
    const result = parseHeaders(headers);
    assert.equal(result.from, 'john@example.com');
    assert.equal(result.subject, 'Hello');
    assert.equal(result['list-unsubscribe'], '<http://unsub>');
  });

  it('returns empty object for null/undefined', () => {
    assert.deepEqual(parseHeaders(null), {});
    assert.deepEqual(parseHeaders(undefined), {});
  });

  it('returns empty object for empty array', () => {
    assert.deepEqual(parseHeaders([]), {});
  });
});
