import { google } from 'googleapis';
import { RateLimiter, withRetry } from './rate-limiter.js';

/**
 * Thin wrapper around the Gmail API that internalizes rate limiting and retry.
 * All command modules use this instead of raw google.gmail().
 */
export class GmailClient {
  constructor(auth) {
    this.api = google.gmail({ version: 'v1', auth });
    this.limiter = new RateLimiter(10);
  }

  async _call(fn) {
    await this.limiter.wait();
    return withRetry(fn);
  }

  /** List message stubs (id only). Handles pagination up to `max` messages. */
  async listMessages({ q, labelIds, max = 500 } = {}) {
    const all = [];
    let pageToken;
    do {
      const params = { userId: 'me', maxResults: Math.min(max - all.length, 100) };
      if (q) params.q = q;
      if (labelIds) params.labelIds = labelIds;
      if (pageToken) params.pageToken = pageToken;

      const res = await this._call(() => this.api.users.messages.list(params));
      if (res.data.messages) all.push(...res.data.messages);
      pageToken = res.data.nextPageToken;
    } while (pageToken && all.length < max);
    return all;
  }

  /** Get a single message's metadata headers. */
  async getMessage(id, metadataHeaders = ['From', 'Subject', 'List-Unsubscribe', 'List-ID']) {
    const res = await this._call(() =>
      this.api.users.messages.get({
        userId: 'me', id, format: 'metadata', metadataHeaders,
      })
    );
    return res.data;
  }

  /** Batch modify messages (add/remove labels). Chunks into batches of 50. */
  async batchModify(ids, { addLabelIds, removeLabelIds } = {}) {
    const BATCH = 50;
    for (let i = 0; i < ids.length; i += BATCH) {
      const chunk = ids.slice(i, i + BATCH);
      const body = { ids: chunk };
      if (addLabelIds) body.addLabelIds = addLabelIds;
      if (removeLabelIds) body.removeLabelIds = removeLabelIds;
      await this._call(() =>
        this.api.users.messages.batchModify({ userId: 'me', requestBody: body })
      );
    }
  }

  /** List all Gmail filters. */
  async listFilters() {
    const res = await this._call(() => this.api.users.settings.filters.list({ userId: 'me' }));
    return res.data.filter || [];
  }

  /** Create a Gmail filter. */
  async createFilter(criteria, action) {
    return this._call(() =>
      this.api.users.settings.filters.create({
        userId: 'me', requestBody: { criteria, action },
      })
    );
  }

  /** Delete a Gmail filter by id. */
  async deleteFilter(id) {
    return this._call(() =>
      this.api.users.settings.filters.delete({ userId: 'me', id })
    );
  }

  /** List all labels. */
  async listLabels() {
    const res = await this._call(() => this.api.users.labels.list({ userId: 'me' }));
    return res.data.labels || [];
  }

  /** Create a label. Returns the created label object. */
  async createLabel(name) {
    const res = await this._call(() =>
      this.api.users.labels.create({
        userId: 'me',
        requestBody: { name, labelListVisibility: 'labelShow', messageListVisibility: 'show' },
      })
    );
    return res.data;
  }
}
