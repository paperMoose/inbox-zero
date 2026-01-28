import dotenv from 'dotenv';
dotenv.config();

export function loadConfig() {
  return {
    vipEmails: parseList(process.env.VIP_EMAILS),
    protectedSenders: parseList(process.env.PROTECTED_SENDERS),
    protectedKeywords: parseList(process.env.PROTECTED_KEYWORDS).map(k => k.toLowerCase()),
  };
}

function parseList(val) {
  if (!val) return [];
  return val.split(',').map(s => s.trim()).filter(Boolean);
}
