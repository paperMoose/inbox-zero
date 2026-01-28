import chalk from 'chalk';
import ora from 'ora';
import readline from 'readline/promises';
import { GmailClient } from '../lib/gmail.js';
import { extractEmail } from '../lib/parse.js';
import { isProtected } from '../lib/protected.js';

/**
 * Legitimate-service patterns and transaction keywords used to identify false positives.
 */
const LEGITIMATE_RE = [
  /@chase\.com$/, /@capitalone\.com$/, /@mercury\.com$/, /@stripe\.com$/,
  /@paypal\.com$/, /@venmo\.com$/, /@coinbase\.com$/, /@robinhood\.com$/,
  /@apple\.com$/, /@google\.com$/, /@anthropic\.com$/, /@openai\.com$/,
  /@github\.com$/, /@gitlab\.com$/,
  /@sutterhealth\.org$/, /@myhealth/, /@kaiserpermanente\.org$/,
  /@united\.com$/, /@delta\.com$/, /@southwest\.com$/, /@airbnb\.com$/, /@booking\.com$/,
  /@rippling\.com$/, /@gusto\.com$/, /@adp\.com$/,
  /@uber\.com$/, /@doordash\.com$/, /@grubhub\.com$/, /@instacart\.com$/,
  /@pge\.com$/, /@comcast\.com$/, /@att\.com$/, /@verizon\.com$/,
];

const TRANSACTION_KW = [
  'payment', 'receipt', 'order', 'confirmation', 'invoice', 'payroll',
  'benefits', 'appointment', 'reservation', 'statement', 'bill',
  'charged', 'refund', 'shipped', 'delivered',
];

const SERVICE_DOMAINS = [
  'mailchimp.com', 'sendgrid.net', 'mailgun.org', 'amazonses.com',
  'beehiiv.com', 'substack.com', 'constantcontact.com',
];

/**
 * Scan "Likely Spam" label for false positives, rescue them.
 */
export async function run(auth, config) {
  const gmail = new GmailClient(auth);
  const protectedSenders = config.protectedSenders;
  const vipEmails = config.vipEmails.map(e => e.toLowerCase().trim());

  // Find the "Likely Spam" label
  const allLabels = await gmail.listLabels();
  const spamLabel = allLabels.find(l => l.name === 'Likely Spam');
  if (!spamLabel) {
    console.log(chalk.yellow('No "Likely Spam" label found. Nothing to do.'));
    return;
  }

  const spinner = ora('Fetching Likely Spam emails...').start();
  const messages = await gmail.listMessages({ labelIds: [spamLabel.id], max: 5000 });
  spinner.succeed(`Found ${messages.length} emails in Likely Spam`);
  if (!messages.length) return;

  // Analyze
  const legitimate = [];
  const suspicious = [];
  const aSpinner = ora('Analyzing...').start();
  const BATCH = 20;

  for (let i = 0; i < messages.length; i += BATCH) {
    const batch = messages.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(async (msg) => {
      try {
        const data = await gmail.getMessage(msg.id, ['From', 'Subject', 'Date']);
        const headers = {};
        for (const h of data.payload?.headers || []) headers[h.name.toLowerCase()] = h.value;
        const from = headers.from || '';
        const fromEmail = extractEmail(from).toLowerCase();
        const subject = headers.subject || '';
        return { id: msg.id, from, fromEmail, subject };
      } catch { return null; }
    }));

    for (const e of results) {
      if (!e) continue;
      if (isLegitimate(e, vipEmails, protectedSenders)) {
        legitimate.push(e);
      } else {
        suspicious.push(e);
      }
    }
    aSpinner.text = `Analyzed ${Math.min(i + BATCH, messages.length)} of ${messages.length}`;
  }
  aSpinner.succeed(`Legitimate: ${legitimate.length}, Spam: ${suspicious.length}`);

  // Display
  if (legitimate.length) {
    console.log('\n' + chalk.yellow('Potentially legitimate emails:'));
    const bySender = {};
    for (const e of legitimate) {
      (bySender[e.fromEmail] ??= []).push(e);
    }
    for (const [sender, emails] of Object.entries(bySender).sort((a, b) => b[1].length - a[1].length)) {
      console.log(chalk.yellow(`  ${sender} (${emails.length})`));
      emails.slice(0, 3).forEach(e => {
        const subj = e.subject.length > 60 ? e.subject.slice(0, 60) + '...' : e.subject;
        console.log(chalk.gray(`    "${subj}"`));
      });
    }

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await rl.question(chalk.yellow(`\nRescue ${legitimate.length} emails to inbox? (y/n): `));
    rl.close();

    if (answer.toLowerCase() === 'y') {
      const ids = legitimate.map(e => e.id);
      await gmail.batchModify(ids, { addLabelIds: ['INBOX'], removeLabelIds: [spamLabel.id] });
      console.log(chalk.green(`Rescued ${ids.length} emails.`));
    } else {
      console.log(chalk.yellow('No emails moved.'));
    }
  } else {
    console.log(chalk.green('No false positives found.'));
  }
}

function isLegitimate(email, vipEmails, protectedSenders) {
  const { fromEmail, subject, from } = email;
  const subjectLower = subject.toLowerCase();

  if (vipEmails.includes(fromEmail)) return true;
  if (isProtected(fromEmail, protectedSenders)) return true;

  // Known legitimate service + transaction keyword
  if (LEGITIMATE_RE.some(re => re.test(fromEmail))) {
    if (TRANSACTION_KW.some(kw => subjectLower.includes(kw))) return true;
  }

  // Personal email heuristic
  if (!/noreply|no-reply|notification|newsletter|marketing|automated/i.test(fromEmail) &&
      from.includes('<') &&
      !/team|support/i.test(from) &&
      !SERVICE_DOMAINS.some(d => fromEmail.includes(d))) {
    return true;
  }

  return false;
}
