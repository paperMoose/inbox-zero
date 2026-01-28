#!/usr/bin/env node
import chalk from 'chalk';
import { authorize } from './auth.js';
import { loadConfig } from './config.js';

const COMMANDS = {
  'analyze-filter': () => import('./commands/analyze-filter.js'),
  'continuous':     () => import('./commands/continuous.js'),
  'cleanup':        () => import('./commands/cleanup.js'),
  'spam-rescue':    () => import('./commands/spam-rescue.js'),
  'trash-by-sender':() => import('./commands/trash-by-sender.js'),
};

const command = process.argv[2];
const args = process.argv.slice(3);

if (!command || command === '--help' || !COMMANDS[command]) {
  console.log(chalk.bold.cyan('\nGmail Email Filter\n'));
  console.log('Usage: node src/cli.js <command> [args]\n');
  console.log('Commands:');
  console.log('  analyze-filter    Analyze inbox & apply labels/filters/archiving');
  console.log('  continuous        Checkpoint-based incremental processing');
  console.log('  cleanup           Find bad Gmail filters (dry-run; --apply to delete)');
  console.log('  spam-rescue       Scan Likely Spam for false positives');
  console.log('  trash-by-sender   Trash emails from given senders');
  console.log('');
  process.exit(command === '--help' || !command ? 0 : 1);
}

try {
  const auth = await authorize();
  const config = loadConfig();
  const mod = await COMMANDS[command]();
  await mod.run(auth, config, args);
} catch (err) {
  console.error(chalk.red('Error:'), err.message);
  if (err.message?.includes('invalid_grant')) {
    console.log(chalk.yellow('Try deleting token.json and running again.'));
  }
  process.exit(1);
}
