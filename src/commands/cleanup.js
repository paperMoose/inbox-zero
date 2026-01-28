import chalk from 'chalk';
import ora from 'ora';
import { GmailClient } from '../lib/gmail.js';
import { domainMatchesProtected, PROTECTED_DOMAINS } from '../lib/protected.js';
import { extractDomain } from '../lib/parse.js';

const OVERLY_BROAD_PATTERNS = [
  'donotreply@', 'members@', 'verify@', 'no-reply@', 'noreply@',
  'alerts@', 'notification@', 'notify@',
];

/**
 * Find and fix bad Gmail filters.
 * Dry-run by default; pass --apply as CLI arg to actually delete.
 */
export async function run(auth, _config, args = []) {
  const dryRun = !args.includes('--apply');
  const gmail = new GmailClient(auth);

  console.log(dryRun
    ? chalk.yellow('DRY RUN mode. Use --apply to delete filters.\n')
    : chalk.red('APPLY mode. Filters will be deleted!\n'));

  const spinner = ora('Analyzing filters...').start();
  const filters = await gmail.listFilters();
  const labels = await gmail.listLabels();
  const labelMap = new Map(labels.map(l => [l.id, l.name]));

  const issues = { duplicates: [], protectedMarkedSpam: [], overlyBroad: [] };

  // Duplicates
  const fromMap = new Map();
  for (const f of filters) {
    const from = f.criteria?.from;
    if (!from) continue;
    if (!fromMap.has(from)) fromMap.set(from, []);
    fromMap.get(from).push(f);
  }
  for (const [from, list] of fromMap) {
    if (list.length > 1) issues.duplicates.push({ from, count: list.length, filters: list });
  }

  // Protected domains marked as spam/trash (uses proper suffix matching — bug #4 fix)
  for (const f of filters) {
    const from = f.criteria?.from || '';
    const fromDomain = extractDomain(from) || from; // bare domain case
    const addLabels = f.action?.addLabelIds || [];
    const labelNames = addLabels.map(id => labelMap.get(id) || id);

    const isProtDomain = PROTECTED_DOMAINS.some(pd => domainMatchesProtected(fromDomain, pd));
    if (!isProtDomain) continue;

    if (addLabels.includes('TRASH') || labelNames.some(n => n.toLowerCase().includes('spam'))) {
      issues.protectedMarkedSpam.push({ from, filter: f });
    }
  }

  // Overly broad
  for (const f of filters) {
    const from = f.criteria?.from || '';
    if (!f.criteria?.query && isOverlyBroad(from)) {
      issues.overlyBroad.push({ from, filter: f });
    }
  }
  spinner.succeed('Analysis complete');

  // Report
  console.log('\n' + chalk.bold.cyan('Filter Analysis Report'));
  console.log(chalk.gray('='.repeat(50)));
  console.log(chalk.yellow(`Duplicates: ${issues.duplicates.length}`));
  issues.duplicates.slice(0, 10).forEach(d => console.log(`  - ${d.from} (${d.count} copies)`));
  console.log(chalk.red(`Protected domains marked spam: ${issues.protectedMarkedSpam.length}`));
  issues.protectedMarkedSpam.forEach(i => console.log(`  - ${i.from}`));
  console.log(chalk.yellow(`Overly broad: ${issues.overlyBroad.length}`));
  issues.overlyBroad.forEach(i => console.log(`  - ${i.from}`));

  // Collect filters to delete
  const toDelete = [];
  for (const d of issues.duplicates) toDelete.push(...d.filters.slice(1).map(f => ({ id: f.id, reason: `Duplicate: ${d.from}` })));
  for (const i of issues.protectedMarkedSpam) toDelete.push({ id: i.filter.id, reason: `Protected spam: ${i.from}` });
  for (const i of issues.overlyBroad) toDelete.push({ id: i.filter.id, reason: `Broad: ${i.from}` });

  console.log(chalk.bold(`\nTotal to delete: ${toDelete.length}`));

  if (dryRun) {
    toDelete.slice(0, 20).forEach(f => console.log(chalk.gray(`  - ${f.reason}`)));
    if (toDelete.length > 20) console.log(chalk.gray(`  ... and ${toDelete.length - 20} more`));
    console.log(chalk.yellow('\nRun with --apply to delete.'));
  } else {
    let deleted = 0;
    for (const f of toDelete) {
      try {
        await gmail.deleteFilter(f.id);
        deleted++;
      } catch (err) {
        console.error(`Failed to delete: ${err.message}`);
      }
    }
    console.log(chalk.green(`Deleted ${deleted} filters.`));
  }
}

function isOverlyBroad(from) {
  return OVERLY_BROAD_PATTERNS.some(pattern => {
    if (from === pattern) return true;
    if (from.startsWith(pattern)) {
      const rest = from.slice(pattern.length);
      return !rest.includes('.') || rest.length < 4;
    }
    return false;
  });
}
