# inbox-zero

CLI tool that cleans up your Gmail inbox using the Gmail API. Categorizes emails, applies labels, archives noise, creates filters, rescues false positives from spam, and bulk-trashes unwanted senders.

Built because Gmail's built-in filters aren't smart enough and every inbox eventually becomes a disaster.

## What it does

- **Categorizes** emails into: VIP, protected (banking/healthcare/travel), receipts, confirmations, newsletters, promotional, social, forums, automated
- **Archives** newsletters, promotional, and automated emails out of your inbox (still searchable in All Mail)
- **Labels** everything so you can find it later
- **Creates Gmail filters** for frequent senders so future emails are handled automatically
- **Protects** important emails (financial, healthcare, travel, HR) from ever being filtered
- **Cleans up** bad Gmail filters (duplicates, protected domains incorrectly marked as spam, overly broad patterns)
- **Rescues** false positives from your spam folder
- **Bulk trashes** specific senders and creates auto-trash filters

## Setup

### 1. Google Cloud credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or select existing)
3. Enable the **Gmail API**
4. Create credentials: **OAuth 2.0 Client ID** (Desktop application)
5. Download the JSON and save as `credentials.json` in the project root

### 2. Install and configure

```bash
npm install
cp .env.example .env
```

Edit `.env` with your settings:

```
GMAIL_USER=you@gmail.com
VIP_EMAILS=boss@company.com,partner@example.com
PROTECTED_SENDERS=doctor@hospital.org,alerts@bank.com
PROTECTED_KEYWORDS=appointment,flight,boarding,medical,prescription
```

### 3. First run

```bash
node src/cli.js analyze-filter
```

Opens a browser for Google OAuth on first run. Token is cached after that.

## Commands

```
node src/cli.js <command> [args]
```

| Command | Description |
|---|---|
| `analyze-filter` | Fetch inbox, categorize, show summary, apply labels/filters/archiving |
| `continuous` | Checkpoint-based incremental processing (only new emails since last run) |
| `cleanup` | Find bad Gmail filters. Dry-run by default; pass `--apply` to delete |
| `spam-rescue` | Scan "Likely Spam" label for false positives, rescue to inbox |
| `trash-by-sender` | Trash all emails from given senders and create auto-trash filters |

### Examples

```bash
# Main workflow
npm start

# Incremental processing
npm run continuous

# Audit your filters (safe, read-only)
npm run cleanup

# Delete bad filters
npm run cleanup-apply

# Rescue false positives from spam
npm run spam-rescue

# Permanently trash specific senders
node src/cli.js trash-by-sender spammer@junk.com annoying@newsletter.com
```

## How categorization works

Emails are checked in this priority order:

1. **VIP** - sender is in your VIP list
2. **Protected** - sender is from a protected domain or matches your protected senders
3. **Protected keyword** - subject contains a protected keyword
4. **Receipt** - payment, invoice, order, shipping notification
5. **Confirmation** - appointment, reservation, registration
6. **Newsletter** - `List-Unsubscribe`/`List-ID` headers or newsletter subject patterns
7. **Promotional** - Gmail's Promotions category
8. **Social** - Gmail's Social category
9. **Forums** - Gmail's Forums category
10. **Automated** - noreply/no-reply/donotreply sender patterns
11. **Unknown** - everything else (likely personal email)

Receipts and confirmations are checked **before** newsletter headers so transactional emails with `List-Unsubscribe` don't get miscategorized.

## Built-in protected domains

These are never aggressively filtered:

Chase, Capital One, Citi, Amex, Wells Fargo, Bank of America, PayPal, Venmo, Mercury, Coinbase, Robinhood, Rippling, Google, GitHub, Apple, United, Delta, Southwest, American Airlines, Uber, Lyft, DoorDash, Sutter Health

Add your own via `PROTECTED_SENDERS` in `.env`.

## Testing

```bash
npm test
```

Uses `node:test` with no extra dependencies.

## Troubleshooting

**"invalid_grant" error** - Delete `token.json` and run again to re-authenticate.

**Can't find credentials.json** - Download OAuth credentials from Google Cloud Console and save as `credentials.json` in the project root.

## License

MIT
