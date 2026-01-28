# inbox-zero: Agent Instructions

You are operating a Gmail inbox management toolkit. The user will ask you to clean their email in plain English. Your job is to run the right commands, interpret the results, make smart decisions, and ask the user before doing anything destructive.

## Available commands

All commands run via `node src/cli.js <command> [args]`.

| Command | What it does | Interactive? |
|---|---|---|
| `analyze-filter` | Fetch inbox emails, categorize, display summary, apply labels/filters/archive | Yes, asks `y/n` before applying. Pipe `echo "y"` to auto-confirm. |
| `continuous` | Checkpoint-based incremental processing (only new emails since last run) | Yes, asks `y/n`. |
| `cleanup` | Audit Gmail filters for problems (duplicates, protected domains marked spam, overly broad) | No. Dry-run by default. Pass `--apply` to delete. |
| `spam-rescue` | Scan "Likely Spam" label for false positives, rescue to inbox | Yes, asks `y/n` before rescuing. |
| `trash-by-sender` | Trash all emails from given senders, create auto-trash filters | Yes, requires typing `yes` to confirm. |

## How to clean an inbox

Follow this workflow. Don't just blindly run analyze-filter in a loop.

### Step 1: Scan first, understand what's there

Write an ad-hoc Node.js script that imports from `src/lib/` to scan the inbox. Fetch 1,000-2,000 messages from `in:inbox`, categorize each one, and build a report of:
- Top senders by frequency
- Category breakdown (newsletter, protected, receipt, unknown, etc.)
- Unread count per sender

This gives you and the user a picture of what's actually in the inbox before you start changing anything.

### Step 2: Discuss with the user

Show them the top senders and categories. Ask what they want to do. Some senders are trash (junk newsletters, old services). Some are noise but worth archiving (Luma invites, course emails). Some are real people or important services that should stay.

Don't assume. Let the user decide what gets trashed vs. archived vs. kept.

### Step 3: Trash the junk

Use `trash-by-sender` for senders the user wants permanently gone:
```bash
echo "yes" | node src/cli.js trash-by-sender sender1@junk.com sender2@spam.com
```

This trashes all existing emails AND creates Gmail filters so future emails auto-trash.

### Step 4: Run analyze-filter to archive the noise

```bash
echo "y" | node src/cli.js analyze-filter
```

This archives newsletters, promotional, and automated emails. It also creates Gmail filters for frequent senders. Run it multiple times if needed, each pass processes up to 500 inbox emails.

### Step 5: Handle old email

If there's a huge backlog of old read/unread mail, write a script to:
- Mark emails older than N days as read (removes the unread badge)
- Archive read emails older than N days (removes from inbox but keeps in All Mail)

Use `src/lib/gmail.js` for the API calls. Example:
```js
import { authorize } from './src/auth.js';
import { GmailClient } from './src/lib/gmail.js';
const auth = await authorize();
const gmail = new GmailClient(auth);
const old = await gmail.listMessages({ q: 'in:inbox is:unread before:2025/12/01', max: 5000 });
await gmail.batchModify(old.map(m => m.id), { removeLabelIds: ['UNREAD'] });
```

### Step 6: Audit filters

```bash
node src/cli.js cleanup
```

Review the output. If it finds problems, ask the user before running `--apply`.

### Step 7: Check spam

```bash
echo "y" | node src/cli.js spam-rescue
```

Shows false positives in the "Likely Spam" label and rescues them.

## Key libraries you can import for ad-hoc scripts

When the built-in commands don't cover what you need, write a Node.js script:

```js
import { authorize } from './src/auth.js';
import { GmailClient } from './src/lib/gmail.js';
import { loadConfig } from './src/config.js';
import { parseHeaders, extractEmail } from './src/lib/parse.js';
import { isProtected } from './src/lib/protected.js';
import { categorizeEmail } from './src/lib/categorize.js';
```

- `GmailClient` handles rate limiting and retry internally
- `categorizeEmail` is a pure function, pass it all data as arguments
- `isProtected` checks both hardcoded domains and env-configured senders
- `loadConfig()` reads `.env` for VIP emails, protected senders, keywords

## Architecture

```
src/
  lib/
    parse.js           -- extractEmail, extractDomain, parseHeaders
    protected.js       -- PROTECTED_DOMAINS, isProtected (single source of truth)
    rate-limiter.js    -- RateLimiter (concurrency-safe), sleep, withRetry
    categorize.js      -- categorizeEmail (pure function, no I/O)
    gmail.js           -- GmailClient (rate-limited, retried Gmail API wrapper)
    labels.js          -- LabelManager (ensure/create/cache Gmail labels)
  commands/
    analyze-filter.js  -- Main workflow
    continuous.js      -- Incremental processing
    cleanup.js         -- Filter cleanup
    spam-rescue.js     -- False positive rescue
    trash-by-sender.js -- Bulk trash by sender
  config.js            -- Loads .env vars
  auth.js              -- Google OAuth2
  checkpoint.js        -- Checkpoint file persistence
  cli.js               -- Entry point, command dispatch
test/
  parse.test.js
  protected.test.js
  categorize.test.js
  rate-limiter.test.js
```

## Rules

- **Always ask before trashing.** Archiving is reversible. Trashing is not (after 30 days).
- **Never touch protected emails.** Banking, healthcare, travel, HR. The code handles this, but don't override it.
- **Scan before acting.** Don't run analyze-filter blindly. Understand the inbox first.
- **Multiple accounts:** Delete `token.json` and re-run to authenticate a different account.

## When modifying the code

- Protected domains go in `src/lib/protected.js` only. Nowhere else.
- `categorize.js` stays pure. No I/O, no imports of gmail/labels.
- Rate limiter must stay promise-chain based, not timestamp based.
- Run `npm test` after changes. Regression tests guard against previously-fixed bugs.
