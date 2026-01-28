# inbox-zero

I have never had inbox zero in my life.

Not once. Not in 15 years of using email. I'd open Gmail and see that red badge — 1,707 unread — and feel a low-grade dread that never fully went away. Every morning started with a wall of noise: newsletters I never subscribed to, promotional blasts from a store I bought one thing from in 2019, automated notifications from services I forgot existed, LinkedIn telling me about jobs I don't want.

Buried somewhere in that noise were the emails that actually mattered. A payment confirmation from my bank. A message from a colleague. A doctor's appointment reminder. But finding them meant wading through hundreds of emails that existed for one reason: someone, somewhere, decided my attention was theirs to take.

**Attention is the scarcest resource we have.** Every notification, every unread badge, every piece of spam is a tiny tax on your focus. Individually they're nothing. Collectively they're a constant background hum of cognitive load that we've just accepted as normal.

I decided to stop accepting it.

I built this tool, pointed it at my inbox, and watched it categorize 2,000 emails in minutes. It archived 600+ newsletters and promotional emails. It trashed 783 emails from 14 junk senders and created filters so they'd never come back. It found a Gmail filter that was incorrectly sending my GitHub notifications to spam. It rescued legitimate emails that had been misclassified.

When it was done, I had 295 unread emails. All of them real. All of them things I actually needed to see.

**I have inbox zero for the first time in my life.** And it's insane how much better it feels. That background dread is just gone. I open my email and it's calm. It's manageable. It's actually useful again.

The tools to fight back finally exist. We don't have to let every company with our email address hijack our attention. We can take it back.

---

## What it does

A CLI tool that connects to your Gmail account and takes your inbox back:

- **Categorizes** every email: VIP, protected (banking/healthcare/travel), receipts, confirmations, newsletters, promotional, social, forums, automated
- **Archives** the noise (newsletters, promo, automated) — still searchable, just out of your face
- **Labels** everything so nothing is lost
- **Creates Gmail filters** so the same junk never lands in your inbox again
- **Protects** the emails that matter (financial, healthcare, travel, HR) from ever being touched
- **Cleans up** your existing Gmail filters — finds duplicates, bad rules, overly broad patterns
- **Rescues** legitimate emails that got incorrectly flagged as spam
- **Bulk trashes** specific senders with one command

## The results

On my personal account:

| | Before | After |
|---|---|---|
| Inbox | 5,000+ | 404 |
| Unread | 1,707 | 295 |
| Junk senders auto-trashed | 0 | 14 |
| Gmail filters fixed | — | 1 bad filter deleted |
| Time spent | years of ignoring it | ~20 minutes |

Every remaining email is something that actually needs my attention.

---

## Get started

### 1. Google Cloud credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or select existing)
3. Enable the **Gmail API**
4. Create credentials: **OAuth 2.0 Client ID** (Desktop application)
5. Download the JSON and save as `credentials.json` in the project root

### 2. Install and configure

```bash
git clone https://github.com/paperMoose/inbox-zero.git
cd inbox-zero
npm install
cp .env.example .env
```

Edit `.env`:

```
GMAIL_USER=you@gmail.com
VIP_EMAILS=boss@company.com,partner@example.com
PROTECTED_SENDERS=doctor@hospital.org,alerts@bank.com
PROTECTED_KEYWORDS=appointment,flight,boarding,medical,prescription
```

### 3. Run it

```bash
node src/cli.js analyze-filter
```

First run opens a browser for Google OAuth. After that, the token is cached.

It will show you exactly what it found, ask for confirmation, and only then make changes. Nothing happens without your approval.

## Commands

```
node src/cli.js <command> [args]
```

| Command | What it does |
|---|---|
| `analyze-filter` | The main workflow. Fetches inbox, categorizes, shows summary, applies labels/filters/archiving |
| `continuous` | Incremental mode. Only processes emails since the last run |
| `cleanup` | Audits your Gmail filters for problems. Safe dry-run by default; `--apply` to fix |
| `spam-rescue` | Scans your "Likely Spam" label for false positives and rescues them |
| `trash-by-sender` | Nuclear option. Trashes all emails from specific senders and creates auto-trash filters |

### Examples

```bash
# Clean your inbox
npm start

# Run again later (only processes new emails)
npm run continuous

# Check your filters for problems
npm run cleanup

# Fix the problems
npm run cleanup-apply

# Rescue emails incorrectly marked as spam
npm run spam-rescue

# Never hear from these senders again
node src/cli.js trash-by-sender spammer@junk.com annoying@newsletter.com
```

## How it decides what matters

Emails are categorized in strict priority order. This matters — a payment receipt from PayPal that happens to have an unsubscribe link should be treated as a receipt, not a newsletter.

1. **VIP** — sender is on your VIP list
2. **Protected** — sender is from a protected domain (banks, healthcare, travel, HR)
3. **Protected keyword** — subject contains a protected keyword (appointment, flight, etc.)
4. **Receipt** — payment, invoice, order, shipping notification
5. **Confirmation** — appointment, reservation, registration
6. **Newsletter** — has unsubscribe headers or newsletter subject patterns
7. **Promotional** — Gmail's Promotions category
8. **Social** — Gmail's Social category
9. **Forums** — Gmail's Forums category
10. **Automated** — noreply/no-reply sender patterns
11. **Unknown** — everything else (probably a real person emailing you)

Protected domains that are never filtered (built-in): Chase, Capital One, Citi, Amex, Wells Fargo, Bank of America, PayPal, Venmo, Mercury, Coinbase, Robinhood, Rippling, Google, GitHub, Apple, United, Delta, Southwest, American Airlines, Uber, Lyft, DoorDash, Sutter Health.

Add your own via `PROTECTED_SENDERS` in `.env`.

## Contributing

**This only works with Gmail right now.** That's a problem.

If you use Outlook, Yahoo, ProtonMail, Fastmail, or anything else — your inbox is just as broken as mine was. The categorization logic, the protection rules, the filter cleanup patterns — all of that is email-provider-agnostic. What's needed is an API adapter for each provider.

Here's what would help:

- **Outlook/Microsoft 365 adapter** — Microsoft Graph API
- **Yahoo Mail adapter** — Yahoo Mail API
- **ProtonMail adapter** — ProtonMail Bridge
- **Fastmail adapter** — JMAP protocol
- **Generic IMAP adapter** — covers everything else
- **Better categorization rules** — more patterns, more edge cases, more protected domains
- **Smarter sender analysis** — ML-based classification instead of pattern matching

If your inbox is a disaster and you're tired of it, this is your invitation to fight back. PRs welcome.

## Testing

```bash
npm test
```

57 tests using `node:test`. No extra dependencies. Covers parsing, domain matching, categorization logic, and rate limiter concurrency.

## Troubleshooting

**"invalid_grant" error** — Delete `token.json` and run again to re-authenticate.

**Can't find credentials.json** — Download OAuth credentials from [Google Cloud Console](https://console.cloud.google.com/) and save as `credentials.json` in the project root.

## License

MIT — do whatever you want with it. Just fix your inbox.
