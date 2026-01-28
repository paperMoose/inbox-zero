# inbox-zero

Gmail inbox management tool. Categorizes, labels, archives, and filters emails via the Gmail API.

## Commands

All commands run through `src/cli.js`:

```
node src/cli.js <command> [args]
```

| Command | What it does |
|---|---|
| `analyze-filter` | Fetch 500 recent emails, categorize, display summary, optionally apply labels/filters/archiving |
| `continuous` | Checkpoint-based incremental processing (only emails since last run) |
| `cleanup` | Find bad Gmail filters (duplicates, protected domains marked spam, overly broad). Dry-run by default; pass `--apply` to delete |
| `spam-rescue` | Scan "Likely Spam" label for false positives, rescue legitimate emails to inbox |
| `trash-by-sender` | Trash all emails from given senders and create auto-trash filters. Args: `sender1@x.com sender2@y.com` |

npm scripts map to these: `npm start` = analyze-filter, `npm run continuous`, `npm run cleanup`, etc.

## Architecture

```
src/
  lib/
    parse.js           -- extractEmail, extractDomain, parseHeaders (pure utils)
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

## Key design patterns

**Pure categorization**: `categorize.js` is a pure function with no I/O. All data passed as arguments. Check order matters:
1. VIP -> 2. Protected sender -> 3. Protected keyword -> 4. Receipt -> 5. Confirmation -> 6. Newsletter -> 7. Promotional -> 8. Social -> 9. Forums -> 10. Automated -> 11. Unknown

Receipts and confirmations are checked BEFORE newsletter headers to prevent transactional emails with `List-Unsubscribe` from being miscategorized.

**Concurrency-safe rate limiter**: Uses promise-chaining so concurrent `Promise.all` callers are serialized. Each caller chains behind the previous one.

**Single protection source**: All protected domain logic lives in `protected.js`. Domain matching uses proper suffix checks (`domain === pd || domain.endsWith('.' + pd)`) so `notchase.com` does NOT match `chase.com`.

**Shared Gmail wrapper**: `GmailClient` internalizes rate limiting and retry. All commands use it instead of raw `google.gmail()`.

**Command pattern**: Each command exports `run(auth, config, args)`. `cli.js` handles auth, config, error handling, and dispatches.

## Testing

```
npm test
```

Uses `node:test` + `node:assert` (no extra dependencies). Tests cover:
- Parse utilities
- Protected domain matching (including suffix-matching regression tests)
- Categorization logic (including receipt-before-newsletter regression)
- Rate limiter serialization under `Promise.all`

## Auth setup

Requires `credentials.json` from Google Cloud Console (OAuth 2.0 Client ID with Gmail API enabled). On first run, opens browser for OAuth. Token cached in `token.json`.

## Environment variables (.env)

| Var | Description |
|---|---|
| `GMAIL_USER` | Gmail address (informational only) |
| `VIP_EMAILS` | Comma-separated VIP email addresses |
| `PROTECTED_SENDERS` | Comma-separated emails/domains that should never be filtered |
| `PROTECTED_KEYWORDS` | Comma-separated subject keywords that prevent filtering |

## When modifying

- Never add new protected domains anywhere except `src/lib/protected.js`
- Keep `categorize.js` pure -- no I/O, no imports of gmail/labels
- Rate limiter must stay promise-chain based, not timestamp based
- Run `npm test` after changes -- regression tests guard against previously-fixed bugs
