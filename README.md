# openmetrics

Terminal dashboard for visualizing OpenCode LLM usage metrics.

![Bun](https://img.shields.io/badge/Bun-1.0+-black?logo=bun)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)
![License](https://img.shields.io/badge/License-MIT-green)

## Overview

openmetrics is a developer-focused observability console for LLM usage. It reads an OpenCode SQLite database and provides real-time metrics on:

- Token consumption (input, output, cache)
- Session and message counts
- Estimated costs per model
- Usage trends over time

Built with [Ink](https://github.com/vadimdemedes/ink) (React for CLIs) and runs on [Bun](https://bun.sh).

## Installation

```bash
# Clone the repository
git clone https://github.com/RazoBeckett/openmetrics.git
cd openmetrics

# Install dependencies
bun install
```

## Usage

```bash
# Run with your OpenCode database
bun run src/index.tsx --db ~/.opencode/opencode.db

# Or using the start script
bun start -- --db /path/to/opencode.db

# Show help
bun start -- --help
```

### Command Line Options

| Option | Description |
|--------|-------------|
| `--db, -d <path>` | **Required.** Path to the OpenCode SQLite database |
| `--help, -h` | Show help message |

## Keyboard Controls

| Key | Action |
|-----|--------|
| `TAB` | Switch between panels |
| `j/k` or `↑/↓` | Navigate list items |
| `ENTER` | View model details |
| `ESC` or `b` | Go back from detail view |
| `r` | Refresh metrics |
| `q` | Quit |

## Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│  openmetrics    ~/.opencode/db    212M tokens    $XX.XX     │
├────────────────────────┬────────────────────────────────────┤
│  Models                │  Activity Charts                   │
│  ─────────────────     │  ────────────────                  │
│  claude-sonnet  150M   │  Tokens/Day   ████████▄▄▄         │
│  gpt-4o          50M   │  Messages/Day ██████▄▄▄▄▄         │
│  gemini-pro      12M   │                                    │
├────────────────────────┴────────────────────────────────────┤
│  Recent Sessions                                            │
│  ───────────────                                            │
│  Session Title          Messages   Tokens    Last Updated   │
└─────────────────────────────────────────────────────────────┘
```

## Pricing Data

Model pricing is fetched from [Models.dev](https://models.dev), an open-source database of AI model specifications. Pricing data is cached locally in `.openmetrics-cache.json` to minimize API calls.

If pricing data is unavailable for a model, cost displays as "N/A" rather than failing.

## Database Schema

openmetrics expects an OpenCode-style SQLite database with:

**`message` table:**
- `id`, `session_id`, `time_created`, `time_updated`
- `data` (JSON) containing: `modelId`, `providerId`, `role`, `tokens.input`, `tokens.output`, `tokens.cache.read`, `tokens.cache.write`

**`session` table:**
- `id`, `project_id`, `title`, `directory`, `time_created`, `time_updated`

## Development

```bash
# Run with hot reload
bun run dev -- --db /path/to/db

# Type check
bun run typecheck

# Build for distribution
bun run build
```

## Tech Stack

- **Runtime:** [Bun](https://bun.sh) with native SQLite driver
- **UI Framework:** [Ink](https://github.com/vadimdemedes/ink) (React for terminals)
- **Components:** [@inkjs/ui](https://github.com/vadimdemedes/ink-ui), [ink-table](https://github.com/vadimdemedes/ink-table)
- **Pricing API:** [Models.dev](https://models.dev)

## License

MIT
