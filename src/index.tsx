#!/usr/bin/env bun
import React from "react";
import { render } from "ink";
import { App } from "./ui/App.tsx";

function printUsage(): void {
  console.log(`
openmetrics - Terminal dashboard for OpenCode LLM usage metrics

Usage:
  openmetrics --db <path>     Path to OpenCode SQLite database

Options:
  --db, -d <path>   Required. Path to the SQLite database file
  --help, -h        Show this help message

Keyboard Controls:
  TAB        Switch between panels
  j/k, ↑/↓   Navigate list items
  ENTER      View model details
  ESC, b     Go back from detail view
  r          Refresh metrics
  q          Quit

Examples:
  openmetrics --db ~/.opencode/opencode.db
  openmetrics -d /path/to/database.db
`);
}

function parseArgs(): { dbPath: string | null; showHelp: boolean } {
  const args = process.argv.slice(2);
  let dbPath: string | null = null;
  let showHelp = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "--help" || arg === "-h") {
      showHelp = true;
      continue;
    }

    if (arg === "--db" || arg === "-d") {
      dbPath = args[++i] || null;
      continue;
    }

    if (arg.startsWith("--db=")) {
      dbPath = arg.slice(5);
      continue;
    }
  }

  return { dbPath, showHelp };
}

async function main(): Promise<void> {
  const { dbPath, showHelp } = parseArgs();

  if (showHelp) {
    printUsage();
    process.exit(0);
  }

  if (!dbPath) {
    console.error("Error: --db <path> is required\n");
    printUsage();
    process.exit(1);
  }

  const file = Bun.file(dbPath);
  if (!(await file.exists())) {
    console.error(`Error: Database file not found: ${dbPath}`);
    process.exit(1);
  }

  const { waitUntilExit } = render(<App dbPath={dbPath} />);
  await waitUntilExit();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
