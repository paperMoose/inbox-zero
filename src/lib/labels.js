/**
 * LabelManager — ensures labels exist (creating if needed) and caches IDs.
 */
export class LabelManager {
  constructor(gmail) {
    this.gmail = gmail;
    this._cache = null; // Map<name, {id, name}>
  }

  /** Populate the cache from Gmail. */
  async _loadCache() {
    if (this._cache) return;
    const labels = await this.gmail.listLabels();
    this._cache = new Map(labels.map(l => [l.name, l]));
  }

  /** Get or create a label by name. Returns { id, name }. */
  async ensure(name) {
    await this._loadCache();
    if (this._cache.has(name)) return this._cache.get(name);

    try {
      const label = await this.gmail.createLabel(name);
      this._cache.set(name, label);
      return label;
    } catch (err) {
      // Race condition: label was created between list and create
      if (err.message?.includes('Label name exists')) {
        const labels = await this.gmail.listLabels();
        const found = labels.find(l => l.name === name);
        if (found) {
          this._cache.set(name, found);
          return found;
        }
      }
      throw err;
    }
  }

  /** Ensure all standard filtering labels exist. Returns Map<name, label>. */
  async ensureStandardLabels() {
    const names = [
      'Filtered/Newsletters',
      'Filtered/Promotional',
      'Filtered/Automated',
      'Filtered/Social',
      'Filtered/Forums',
      'VIP',
      'Protected',
      'Receipts',
      'Confirmations',
      'Personal',
    ];
    const result = {};
    for (const name of names) {
      result[name] = await this.ensure(name);
    }
    return result;
  }
}
