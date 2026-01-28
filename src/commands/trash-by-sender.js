import chalk from 'chalk';
import ora from 'ora';
import readline from 'readline/promises';
import { GmailClient } from '../lib/gmail.js';

/**
 * General-purpose: trash all emails from given senders and create Gmail filters.
 * Usage: node src/cli.js trash-by-sender sender1@x.com sender2@y.com
 */
export async function run(auth, _config, args = []) {
  const senders = args.filter(a => a.includes('@'));
  if (!senders.length) {
    console.log('Usage: trash-by-sender sender1@example.com sender2@example.com');
    console.log('Trashes all emails from the given senders and creates filters to auto-trash future emails.');
    return;
  }

  const gmail = new GmailClient(auth);

  // Gather counts
  const spinner = ora('Counting emails...').start();
  const counts = {};
  let total = 0;
  for (const sender of senders) {
    const msgs = await gmail.listMessages({ q: `from:${sender}` });
    counts[sender] = msgs.length;
    total += msgs.length;
    spinner.text = `Counted ${sender}: ${msgs.length}`;
  }
  spinner.succeed(`Found ${total} emails from ${senders.length} senders`);

  // Display
  for (const [sender, count] of Object.entries(counts)) {
    console.log(`  ${sender}: ${count} emails`);
  }

  // Confirm
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(chalk.red(`\nTrash ${total} emails and create filters? Type "yes" to confirm: `));
  rl.close();
  if (answer.trim().toLowerCase() !== 'yes') {
    console.log(chalk.yellow('Cancelled.'));
    return;
  }

  // Get existing filters to avoid duplicates
  const existing = await gmail.listFilters();
  const existingFroms = new Set(existing.map(f => f.criteria?.from?.toLowerCase()).filter(Boolean));

  let trashed = 0;
  let filtersCreated = 0;

  for (const sender of senders) {
    // Create filter
    if (!existingFroms.has(sender.toLowerCase())) {
      try {
        await gmail.createFilter(
          { from: sender },
          { addLabelIds: ['TRASH'] }
        );
        filtersCreated++;
      } catch { /* may already exist */ }
    }

    // Trash existing emails
    const msgs = await gmail.listMessages({ q: `from:${sender}` });
    if (msgs.length) {
      const ids = msgs.map(m => m.id);
      await gmail.batchModify(ids, { addLabelIds: ['TRASH'], removeLabelIds: ['INBOX', 'UNREAD'] });
      trashed += ids.length;
      console.log(`  Trashed ${ids.length} from ${sender}`);
    }
  }

  console.log(chalk.green(`\nDone. ${trashed} emails trashed, ${filtersCreated} filters created.`));
}
