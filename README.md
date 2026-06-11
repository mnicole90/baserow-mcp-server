# Baserow MCP Server

[![npm version](https://img.shields.io/npm/v/@mnicole-dev/baserow-mcp-server.svg)](https://www.npmjs.com/package/@mnicole-dev/baserow-mcp-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

MCP (Model Context Protocol) server for [Baserow](https://baserow.io) — works with cloud Baserow as well as self-hosted instances.

Lets an MCP client (Claude Desktop, Claude Code, Cursor, etc.) interact with your Baserow databases : list databases, fetch fields, query rows, create / update / delete rows.

## Installation

No install needed — run on demand via `npx`. The MCP client launches it as a child process and pipes JSON-RPC over stdio.

## Configuration

Two environment variables are required by the server :

| Variable | Description | Example |
|----------|-------------|---------|
| `BASEROW_URL` | Base URL of your Baserow instance (no trailing slash) | `https://api.baserow.io` or `https://baserow.example.com` |
| `BASEROW_API_TOKEN` | Database token created in Baserow → Settings → API tokens | `aBc123...` |

### Claude Code (or Claude Desktop)

Edit your MCP servers configuration (`~/.claude.json` for Claude Code, `~/Library/Application Support/Claude/claude_desktop_config.json` for Claude Desktop) and add :

```json
{
  "mcpServers": {
    "baserow": {
      "command": "npx",
      "args": ["-y", "@mnicole-dev/baserow-mcp-server"],
      "env": {
        "BASEROW_URL": "https://baserow.example.com",
        "BASEROW_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

Restart your MCP client.

### Cursor

Add to `.cursor/mcp.json` (project-level) or global Cursor settings :

```json
{
  "mcpServers": {
    "baserow": {
      "command": "npx",
      "args": ["-y", "@mnicole-dev/baserow-mcp-server"],
      "env": {
        "BASEROW_URL": "https://baserow.example.com",
        "BASEROW_API_TOKEN": "your-api-token"
      }
    }
  }
}
```

## Available tools

| Tool | Description |
|------|-------------|
| `list-databases` | List all databases the token has access to |
| `list-tables` | List tables for a given database |
| `get-fields` | Get the fields (columns) of a table |
| `list-rows` | List rows of a table with pagination + filters |
| `get-row` | Fetch a single row by ID |
| `create-row` | Create a new row |
| `update-row` | Update an existing row |
| `delete-row` | Delete a row |

All tools accept friendly arguments validated via [Zod](https://github.com/colinhacks/zod).

## Local development

```bash
git clone https://github.com/mnicole90/baserow-mcp-server.git
cd baserow-mcp-server
npm install
npm run build
```

To run locally with an MCP client during development :

```bash
node dist/index.js
```

The server communicates over stdio.

## License

MIT — see [LICENSE](LICENSE).

## Author

[Maxime Nicole](https://github.com/mnicole90) — [KodeSaaS](https://kodesaas.com)
