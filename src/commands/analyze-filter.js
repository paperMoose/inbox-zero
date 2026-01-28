import chalk from 'chalk';
import ora from 'ora';
import readline from 'readline/promises';
import { GmailClient } from '../lib/gmail.js';
import { LabelManager } from '../lib/labels.js';
import { parseHeaders, extractEmail } from '../lib/parse.js';
import { isProtected } from '../lib/protected.js';
import { categorizeEmail } from '../lib/categorize.js';

/**
 * Main analyze + filter workflow.
 * Fetches inbox, categorizes, displays summary, optionally applies labels/filters/archiving.
 */
export async function run(auth, config) {
  const gmail = new GmailClient(auth);
  const vipEmails = config.vipEmails.map(e => e.toLowerCase().trim());
  const protectedSenders = config.protectedSenders;
  const protectedKeywords = config.protectedKeywords;
  const isProtectedFn = (email) => isProtected(email, protectedSenders);

  // 1. Fetch
  const spinner = ora('Fetching inbox emails...').start();
  const messages = await gmail.listMessages({ q: 'in:inbox', max: 500 });
  spinner.succeed(`Fetched ${messages.length} email IDs`);

  // 2. Analyze
  const stats = { total: 0, vip: [], protected: [], newsletter: [], promotional: [], social: [], forums: [], automated: [], receipt: [], confirmation: [], unknown: [] };
  const analyzeSpinner = ora('Analyzing emails...').start();
  const BATCH = 10;

  for (let i = 0; i < messages.length; i += BATCH) {
    const batch = messages.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(async (msg) => {
      try {
        const data = await gmail.getMessage(msg.id);
        const headers = parseHeaders(data.payload?.headers);
        const fromEmail = extractEmail(headers.from || '');
        const category = categorizeEmail({
          fromEmail,
          subject: headers.subject || '',
          labelIds: data.labelIds || [],
          headers,
          vipEmails,
          isProtectedFn,
          protectedKeywords,
        });
        return { id: msg.id, from: headers.from || '', fromEmail, subject: headers.subject || '', category };
      } catch {
        return null;
      }
    }));

    for (const r of results) {
      if (!r) continue;
      stats.total++;
      stats[r.category]?.push(r);
    }
    analyzeSpinner.text = `Analyzed ${Math.min(i + BATCH, messages.length)} of ${messages.length}`;
  }
  analyzeSpinner.succeed('Analysis complete');

  // 3. Display summary
  displaySummary(stats);

  // 4. Ask to apply
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('\n' + chalk.yellow('Apply filtering rules? (y/n): '));
  rl.close();
  if (answer.toLowerCase() !== 'y') {
    console.log(chalk.yellow('Cancelled.'));
    return;
  }

  // 5. Setup labels & apply
  const labelMgr = new LabelManager(gmail);
  const labels = await labelMgr.ensureStandardLabels();

  const actions = [
    { key: 'newsletter',   label: 'Filtered/Newsletters', archive: true },
    { key: 'promotional',  label: 'Filtered/Promotional', archive: true },
    { key: 'automated',    label: 'Filtered/Automated',   archive: true },
    { key: 'social',       label: 'Filtered/Social',      archive: false },
    { key: 'forums',       label: 'Filtered/Forums',      archive: false },
    { key: 'vip',          label: 'VIP',                   archive: false },
    { key: 'protected',    label: 'Protected',             archive: false },
    { key: 'receipt',      label: 'Receipts',              archive: false },
    { key: 'confirmation', label: 'Confirmations',         archive: false },
  ];

  const applySpinner = ora('Applying labels...').start();
  for (const action of actions) {
    const ids = stats[action.key].map(e => e.id);
    if (!ids.length) continue;
    const labelId = labels[action.label]?.id;
    if (labelId) {
      await gmail.batchModify(ids, { addLabelIds: [labelId] });
      if (action.archive) {
        await gmail.batchModify(ids, { removeLabelIds: ['INBOX'] });
      }
    }
  }
  applySpinner.succeed('Labels applied');

  // 6. Create Gmail filters for frequent senders in archivable categories
  const filterSpinner = ora('Creating Gmail filters...').start();
  const existingFilters = await gmail.listFilters();
  const existingFroms = new Set(existingFilters.map(f => f.criteria?.from?.toLowerCase()).filter(Boolean));
  let created = 0;

  for (const key of ['newsletter', 'promotional', 'automated']) {
    const frequent = getFrequentSenders(stats[key], 3);
    const labelName = actions.find(a => a.key === key).label;
    const labelId = labels[labelName]?.id;
    if (!labelId) continue;

    for (const sender of frequent) {
      if (existingFroms.has(sender) || isProtectedFn(sender)) continue;
      try {
        await gmail.createFilter(
          { from: sender, excludeChats: true },
          { addLabelIds: [labelId], removeLabelIds: ['INBOX'] }
        );
        created++;
      } catch { /* filter may already exist */ }
    }
  }
  filterSpinner.succeed(`Created ${created} Gmail filters`);

  // Summary
  const archived = stats.newsletter.length + stats.promotional.length + stats.automated.length;
  console.log(chalk.green(`\nDone. ${archived} emails archived, ${created} filters created.`));
}

function displaySummary(stats) {
  console.log('\n' + chalk.bold.cyan('Email Analysis Summary'));
  console.log(chalk.gray('='.repeat(40)));
  console.log(`Total: ${stats.total}`);
  console.log(chalk.green(`  VIP: ${stats.vip.length}`));
  console.log(chalk.green(`  Protected: ${stats.protected.length}`));
  console.log(chalk.yellow(`  Newsletters: ${stats.newsletter.length}`));
  console.log(chalk.yellow(`  Promotional: ${stats.promotional.length}`));
  console.log(chalk.blue(`  Social: ${stats.social.length}`));
  console.log(chalk.blue(`  Forums: ${stats.forums.length}`));
  console.log(chalk.red(`  Automated: ${stats.automated.length}`));
  console.log(chalk.green(`  Receipts: ${stats.receipt.length}`));
  console.log(chalk.cyan(`  Confirmations: ${stats.confirmation.length}`));
  console.log(chalk.gray(`  Unknown: ${stats.unknown.length}`));

  // Top senders
  const freq = new Map();
  for (const cat of Object.values(stats)) {
    if (!Array.isArray(cat)) continue;
    for (const e of cat) {
      if (e.fromEmail) freq.set(e.fromEmail, (freq.get(e.fromEmail) || 0) + 1);
    }
  }
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  if (top.length) {
    console.log('\n' + chalk.bold.cyan('Top Senders:'));
    top.forEach(([email, count], i) => console.log(`  ${i + 1}. ${email} (${count})`));
  }
}

function getFrequentSenders(emails, min) {
  const counts = {};
  for (const e of emails) {
    if (e.fromEmail) counts[e.fromEmail] = (counts[e.fromEmail] || 0) + 1;
  }
  return Object.entries(counts).filter(([, c]) => c >= min).map(([s]) => s);
}
