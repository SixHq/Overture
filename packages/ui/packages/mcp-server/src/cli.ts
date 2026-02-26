#!/usr/bin/env node

/**
 * Overture CLI - Agent Plan Visualizer
 *
 * This is the CLI entry point for running Overture as a standalone server.
 * For MCP integration, the index.ts entry point should be used.
 */

import chalk from 'chalk';
import open from 'open';
import { wsManager } from './websocket/ws-server.js';
import { startHttpServer } from './http/server.js';

const HTTP_PORT = parseInt(process.env.OVERTURE_HTTP_PORT || '3031', 10);
const WS_PORT = parseInt(process.env.OVERTURE_WS_PORT || '3030', 10);

function printBanner() {
  console.log(
    chalk.cyan(`
   ____                 __
  / __ \\__  _____ _____/ /___  __________
 / / / / / / / _ \\/ ___/ __/ / / / ___/ _ \\
/ /_/ / /_/ /  __/ /  / /_/ /_/ / /  /  __/
\\____/\\__,_/\\___/_/   \\__/\\__,_/_/   \\___/

    `)
  );
  console.log(chalk.gray('Agent Plan Visualizer by Sixth'));
  console.log(chalk.gray('─'.repeat(45)));
  console.log();
}

async function main() {
  printBanner();

  // Start HTTP server
  console.log(chalk.blue('Starting servers...'));
  startHttpServer(HTTP_PORT);

  // Start WebSocket server
  wsManager.start(WS_PORT);

  console.log();
  console.log(chalk.green('✓'), 'Overture is running!');
  console.log();
  console.log(chalk.gray('  UI:        '), chalk.cyan(`http://localhost:${HTTP_PORT}`));
  console.log(chalk.gray('  WebSocket: '), chalk.cyan(`ws://localhost:${WS_PORT}`));
  console.log();
  console.log(chalk.gray('Press Ctrl+C to stop'));

  // Open browser
  setTimeout(() => {
    open(`http://localhost:${HTTP_PORT}`);
  }, 500);

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log();
    console.log(chalk.yellow('Shutting down...'));
    wsManager.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    wsManager.stop();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error(chalk.red('Fatal error:'), error);
  process.exit(1);
});
