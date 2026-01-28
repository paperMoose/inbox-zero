import chalk from 'chalk';
import ora from 'ora';
import readline from 'readline/promises';
import { GmailClient } from '../lib/gmail.js';
import { LabelManager } from '../lib/labels.js';
import { parseHeaders, extractEmail } from '../lib/parse.js';
import { isProtected } from '../lib/protected.js';
import { categorizeEmail } from '../lib/categorize.js';
import { loadCheckpoint, updateCheckpoint } from '../checkpoint.js';

/**
 * Checkpoint-based incremental processing.
 * Fetches only emails since the last run, categorizes, applies labels, updates checkpoint.
 */
export async function run(auth, config) {
  const gmail = new GmailClient(auth);
  const vipEmails = config.vipEmails.map(e => e.toLowerCase().trim());
  const protectedSenders = config.protectedSenders;
  const protectedKeywords = config.protectedKeywords;
  const isProtectedFn = (email) => isProtected(email, protectedSenders);

  const checkpoint = await loadCheckpoint();
  if (checkpoint.lastProcessedDate) {
    console.log(chalk.cyan(`Last processed: ${checkpoint.lastProcessedDate} (${checkpoint.totalProcessed} total)`));
  }

  let continueProcessing = true;
  while (continueProcessing) {
    // Fetch
    const q = checkpoint.lastProcessedDate ? `after:${checkpoint.lastProcessedDate}` : undefined;
    const spinner = ora(q ? `Fetching emails since ${checkpoint.lastProcessedDate}...` : 'Fetching recent emails...').start();
    const messages = await gmail.listMessages({ q, max: 500 });
    spinner.succeed(`Fetched ${messages.length} email IDs`);

    if (messages.length === 0) {
      console.log(chalk.yellow('No new emails to process.'));
      return;
    }

    // Analyze
    const stats = { total: 0, vip: [], protected: [], newsletter: [], promotional: [], social: [], forums: [], automated: [], receipt: [], confirmation: [], unknown: [] };
    const aSpinner = ora('Analyzing...').start();
    const BATCH = 10;
    for (let i = 0; i < messages.length; i += BATCH) {
      const batch = messages.slice(i, i + BATCH);
      const results = await Promise.all(batch.map(async (msg) => {
        try {
          const data = await gmail.getMessage(msg.id);
          const headers = parseHeaders(data.payload?.headers);
          const fromEmail = extractEmail(headers.from || '');
          const category = categorizeEmail({
            fromEmail, subject: headers.subject || '', labelIds: data.labelIds || [],
            headers, vipEmails, isProtectedFn, protectedKeywords,
          });
          return { id: msg.id, fromEmail, category };
        } catch { return null; }
      }));
      for (const r of results) {
        if (!r) continue;
        stats.total++;
        stats[r.category]?.push(r);
      }
      aSpinner.text = `Analyzed ${Math.min(i + BATCH, messages.length)} of ${messages.length}`;
    }
    aSpinner.succeed(`Analyzed ${stats.total} emails`);

    // Summary
    console.log(`  Newsletters: ${stats.newsletter.length}, Promotional: ${stats.promotional.length}, Automated: ${stats.automated.length}`);
    console.log(`  Receipts: ${stats.receipt.length}, Confirmations: ${stats.confirmation.length}, VIP: ${stats.vip.length}`);

    // Ask
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(chalk.yellow('\nApply filtering? (y/n): '));
    if (answer.toLowerCase() !== 'y') {
      rl.close();
      console.log(chalk.yellow('Skipped.'));
      return;
    }

    // Apply
    const labelMgr = new LabelManager(gmail);
    const labels = await labelMgr.ensureStandardLabels();
    const actions = [
      { key: 'newsletter', label: 'Filtered/Newsletters', archive: true },
      { key: 'promotional', label: 'Filtered/Promotional', archive: true },
      { key: 'automated', label: 'Filtered/Automated', archive: true },
      { key: 'social', label: 'Filtered/Social', archive: false },
      { key: 'forums', label: 'Filtered/Forums', archive: false },
      { key: 'vip', label: 'VIP', archive: false },
      { key: 'protected', label: 'Protected', archive: false },
      { key: 'receipt', label: 'Receipts', archive: false },
      { key: 'confirmation', label: 'Confirmations', archive: false },
    ];

    for (const action of actions) {
      const ids = stats[action.key].map(e => e.id);
      if (!ids.length) continue;
      const labelId = labels[action.label]?.id;
      if (!labelId) continue;
      await gmail.batchModify(ids, { addLabelIds: [labelId] });
      if (action.archive) await gmail.batchModify(ids, { removeLabelIds: ['INBOX'] });
    }

    // Update checkpoint
    const now = new Date().toISOString().split('T')[0];
    await updateCheckpoint({
      lastProcessedDate: now,
      totalProcessed: (checkpoint.totalProcessed || 0) + messages.length,
    });
    console.log(chalk.green(`Done. Checkpoint updated to ${now}.`));

    // Continue?
    if (messages.length >= 500) {
      const more = await rl.question(chalk.yellow('More emails may be available. Continue? (y/n): '));
      continueProcessing = more.toLowerCase() === 'y';
    } else {
      continueProcessing = false;
    }
    rl.close();
  }
}
