import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { categorizeEmail } from '../src/lib/categorize.js';

function make(overrides = {}) {
  return {
    fromEmail: 'someone@example.com',
    subject: 'Hello',
    labelIds: [],
    headers: {},
    vipEmails: [],
    isProtectedFn: () => false,
    protectedKeywords: [],
    ...overrides,
  };
}

describe('categorizeEmail', () => {
  it('returns vip for VIP sender', () => {
    assert.equal(categorizeEmail(make({ fromEmail: 'boss@co.com', vipEmails: ['boss@co.com'] })), 'vip');
  });

  it('returns protected for protected sender', () => {
    assert.equal(categorizeEmail(make({ isProtectedFn: () => true })), 'protected');
  });

  it('returns protected for protected keyword in subject', () => {
    assert.equal(
      categorizeEmail(make({ subject: 'Your appointment is confirmed', protectedKeywords: ['appointment'] })),
      'protected'
    );
  });

  it('returns receipt for receipt subject', () => {
    assert.equal(categorizeEmail(make({ subject: 'Your payment receipt' })), 'receipt');
  });

  it('returns receipt for PayPal sender', () => {
    assert.equal(categorizeEmail(make({ fromEmail: 'service@paypal.com' })), 'receipt');
  });

  it('returns confirmation for confirmation subject', () => {
    assert.equal(categorizeEmail(make({ subject: 'Booking Confirmation' })), 'confirmation');
  });

  // BUG #1 REGRESSION: receipt with List-Unsubscribe should be receipt, NOT newsletter
  it('receipt with List-Unsubscribe header is categorized as receipt (bug #1)', () => {
    const result = categorizeEmail(make({
      subject: 'Your payment receipt',
      headers: { 'list-unsubscribe': '<http://unsub>' },
    }));
    assert.equal(result, 'receipt');
  });

  it('confirmation with List-Unsubscribe header is categorized as confirmation (bug #1)', () => {
    const result = categorizeEmail(make({
      subject: 'Your reservation is confirmed',
      headers: { 'list-unsubscribe': '<http://unsub>' },
    }));
    assert.equal(result, 'confirmation');
  });

  it('returns newsletter for List-Unsubscribe header', () => {
    assert.equal(
      categorizeEmail(make({ headers: { 'list-unsubscribe': '<http://unsub>' } })),
      'newsletter'
    );
  });

  it('returns newsletter for List-ID header', () => {
    assert.equal(
      categorizeEmail(make({ headers: { 'list-id': '<list.example.com>' } })),
      'newsletter'
    );
  });

  it('returns newsletter for newsletter subject pattern', () => {
    assert.equal(categorizeEmail(make({ subject: 'Weekly Digest: top stories' })), 'newsletter');
  });

  it('returns promotional for CATEGORY_PROMOTIONS label', () => {
    assert.equal(categorizeEmail(make({ labelIds: ['CATEGORY_PROMOTIONS'] })), 'promotional');
  });

  it('returns social for CATEGORY_SOCIAL label', () => {
    assert.equal(categorizeEmail(make({ labelIds: ['CATEGORY_SOCIAL'] })), 'social');
  });

  it('returns forums for CATEGORY_FORUMS label', () => {
    assert.equal(categorizeEmail(make({ labelIds: ['CATEGORY_FORUMS'] })), 'forums');
  });

  it('returns automated for noreply sender', () => {
    assert.equal(categorizeEmail(make({ fromEmail: 'noreply@something.com' })), 'automated');
  });

  it('returns automated for no-reply sender', () => {
    assert.equal(categorizeEmail(make({ fromEmail: 'no-reply@something.com' })), 'automated');
  });

  it('returns unknown for unmatched email', () => {
    assert.equal(categorizeEmail(make()), 'unknown');
  });

  // Priority ordering
  it('VIP takes precedence over everything', () => {
    assert.equal(categorizeEmail(make({
      fromEmail: 'boss@co.com',
      vipEmails: ['boss@co.com'],
      isProtectedFn: () => true,
      subject: 'Your payment receipt',
      headers: { 'list-unsubscribe': '<http://unsub>' },
      labelIds: ['CATEGORY_PROMOTIONS'],
    })), 'vip');
  });

  it('protected takes precedence over receipt', () => {
    assert.equal(categorizeEmail(make({
      isProtectedFn: () => true,
      subject: 'Your payment receipt',
    })), 'protected');
  });

  it('receipt takes precedence over newsletter header', () => {
    assert.equal(categorizeEmail(make({
      subject: 'Invoice #1234',
      headers: { 'list-unsubscribe': '<http://unsub>' },
    })), 'receipt');
  });
});
