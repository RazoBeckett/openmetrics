#!/usr/bin/env bun
import React from "react";
import { withFullScreen } from "fullscreen-ink";
import { App } from "./ui/App.tsx";

function getDefaultDbPath(): string {
  const homedir = process.env.HOME || process.env.USERPROFILE || "/tmp";
  if (process.platform === "win32") {
    const appData = process.env.APPDATA || `${homedir}/AppData/Roaming`;
    return `${appData}/opencode/opencode.db`;
  }
  return `${homedir}/.local/share/opencode/opencode.db`;
}

function printUsage(): void {
  console.log(`
openmetrics - Terminal dashboard for OpenCode LLM usage metrics

Usage:
  openmetrics [--db <path>]     Path to OpenCode SQLite database

Options:
  --db, -d <path>   Path to the SQLite database file
                    Default: ${getDefaultDbPath()}
  --help, -h        Show this help message

Keyboard Controls:
  TAB        Switch between panels
  j/k, ↑/↓   Navigate list items
  ENTER      View model details
  ESC, b     Go back from detail view
  r          Refresh metrics
  q          Quit

Examples:
  openmetrics                           # Use default database path
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

  const finalDbPath = dbPath || getDefaultDbPath();

  const file = Bun.file(finalDbPath);
  if (!(await file.exists())) {
    console.error(`Error: Database file not found: ${finalDbPath}`);
    process.exit(1);
  }

  const app = withFullScreen(<App dbPath={finalDbPath} />);
  await app.start();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
