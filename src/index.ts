#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const BASEROW_URL = process.env.BASEROW_URL || 'https://baserow.mnicole.dev';
const BASEROW_TOKEN = process.env.BASEROW_API_TOKEN || '';

async function baserow(method: string, path: string, body?: unknown): Promise<unknown> {
  const resp = await fetch(`${BASEROW_URL}${path}`, {
    method,
    headers: {
      'Authorization': `Token ${BASEROW_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!resp.ok) throw new Error(`Baserow API error ${resp.status}: ${await resp.text()}`);
  if (resp.status === 204) return null;
  return resp.json();
}

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

// ── Server ─────────────────────────────────────────────────

const server = new McpServer({
  name: 'baserow-mcp-server',
  version: '1.0.0',
});

// ── list-databases ───────────────────────────────────────────

server.tool(
  'list-databases',
  'List all Baserow databases accessible with this token (via all-tables endpoint).',
  {},
  async () => {
    const data = (await baserow('GET', '/api/database/tables/all-tables/')) as Array<{
      id: number;
      name: string;
      order: number;
      database_id: number;
    }>;

    if (!data.length) {
      return textResult('Aucune table accessible avec ce token.');
    }

    // Grouper par database_id
    const byDb = new Map<number, Array<{ id: number; name: string }>>();
    for (const t of data) {
      if (!byDb.has(t.database_id)) byDb.set(t.database_id, []);
      byDb.get(t.database_id)!.push({ id: t.id, name: t.name });
    }

    const lines = [`**${data.length} table(s) accessible(s)**\n`];
    for (const [dbId, tables] of byDb) {
      lines.push(`Database ${dbId}:`);
      for (const t of tables) {
        lines.push(`  - **${t.name}** (table_id: ${t.id})`);
      }
    }

    return textResult(lines.join('\n'));
  },
);

// ── list-tables ──────────────────────────────────────────────

server.tool(
  'list-tables',
  'List all tables in a Baserow database.',
  {
    database_id: z.number().describe('ID of the database'),
  },
  async (params) => {
    const allTables = (await baserow('GET', '/api/database/tables/all-tables/')) as Array<{
      id: number;
      name: string;
      order: number;
      database_id: number;
    }>;
    const data = allTables.filter((t) => t.database_id === params.database_id) as Array<{
      id: number;
      name: string;
      order: number;
    }>;

    if (!data.length) {
      return textResult('Aucune table trouvee dans cette base.');
    }

    const lines = [`**${data.length} table(s)**\n`];
    for (const t of data) {
      lines.push(`- **${t.name}** (id: ${t.id}, order: ${t.order})`);
    }

    return textResult(lines.join('\n'));
  },
);

// ── get-fields ───────────────────────────────────────────────

server.tool(
  'get-fields',
  'Get the field structure (columns) of a Baserow table.',
  {
    table_id: z.number().describe('ID of the table'),
  },
  async (params) => {
    const data = (await baserow('GET', `/api/database/fields/table/${params.table_id}/`)) as Array<{
      id: number;
      name: string;
      type: string;
      order: number;
    }>;

    if (!data.length) {
      return textResult('Aucun champ trouve dans cette table.');
    }

    const lines = [`**${data.length} champ(s)**\n`];
    lines.push('| ID | Nom | Type | Order |');
    lines.push('|----|-----|------|-------|');
    for (const f of data) {
      lines.push(`| ${f.id} | ${f.name} | ${f.type} | ${f.order} |`);
    }

    return textResult(lines.join('\n'));
  },
);

// ── list-rows ────────────────────────────────────────────────

server.tool(
  'list-rows',
  'List rows from a Baserow table with optional search, pagination, and ordering.',
  {
    table_id: z.number().describe('ID of the table'),
    page: z.number().default(1).describe('Page number (default 1)'),
    size: z.number().default(20).describe('Number of rows per page (default 20)'),
    search: z.string().default('').describe('Search query (optional)'),
    order_by: z.string().default('').describe('Order by field name, prefix with - for descending (optional, e.g. "Name" or "-Created")'),
  },
  async (params) => {
    let path = `/api/database/rows/table/${params.table_id}/?user_field_names=true&page=${params.page}&size=${params.size}`;
    if (params.search) path += `&search=${encodeURIComponent(params.search)}`;
    if (params.order_by) path += `&order_by=${encodeURIComponent(params.order_by)}`;

    const data = (await baserow('GET', path)) as {
      count: number;
      results: Array<Record<string, unknown>>;
    };

    if (!data.results?.length) {
      return textResult('Aucune ligne trouvee.');
    }

    // Build markdown table from results
    const rows = data.results;
    const keys = Object.keys(rows[0]!).filter((k) => k !== 'order');

    const lines = [`**${data.count} ligne(s) au total** (page ${params.page}, ${rows.length} affichees)\n`];

    // Header
    lines.push('| ' + keys.join(' | ') + ' |');
    lines.push('| ' + keys.map(() => '---').join(' | ') + ' |');

    // Rows
    for (const row of rows) {
      const values = keys.map((k) => {
        const val = row[k];
        if (val === null || val === undefined) return '';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
      });
      lines.push('| ' + values.join(' | ') + ' |');
    }

    return textResult(lines.join('\n'));
  },
);

// ── get-row ──────────────────────────────────────────────────

server.tool(
  'get-row',
  'Get a single row from a Baserow table by row ID.',
  {
    table_id: z.number().describe('ID of the table'),
    row_id: z.number().describe('ID of the row'),
  },
  async (params) => {
    const data = (await baserow('GET', `/api/database/rows/table/${params.table_id}/${params.row_id}/?user_field_names=true`)) as Record<string, unknown>;

    const lines: string[] = [];
    for (const [key, value] of Object.entries(data)) {
      if (key === 'order') continue;
      const display = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
      lines.push(`**${key}:** ${display}`);
    }

    return textResult(lines.join('\n'));
  },
);

// ── create-row ───────────────────────────────────────────────

server.tool(
  'create-row',
  'Create a new row in a Baserow table. Fields should be a JSON string with field names as keys.',
  {
    table_id: z.number().describe('ID of the table'),
    fields: z.string().describe('JSON string with field values (e.g. {"Nom": "Dupont", "Email": "a@b.com"})'),
  },
  async (params) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(params.fields);
    } catch {
      return textResult('Erreur: le parametre "fields" doit etre un JSON valide.');
    }

    const data = (await baserow('POST', `/api/database/rows/table/${params.table_id}/?user_field_names=true`, parsed)) as Record<string, unknown>;

    const lines = ['Ligne creee avec succes :\n'];
    for (const [key, value] of Object.entries(data)) {
      if (key === 'order') continue;
      const display = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
      lines.push(`**${key}:** ${display}`);
    }

    return textResult(lines.join('\n'));
  },
);

// ── update-row ───────────────────────────────────────────────

server.tool(
  'update-row',
  'Update an existing row in a Baserow table. Fields should be a JSON string with field names as keys.',
  {
    table_id: z.number().describe('ID of the table'),
    row_id: z.number().describe('ID of the row to update'),
    fields: z.string().describe('JSON string with field values to update (e.g. {"Nom": "Martin"})'),
  },
  async (params) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(params.fields);
    } catch {
      return textResult('Erreur: le parametre "fields" doit etre un JSON valide.');
    }

    const data = (await baserow('PATCH', `/api/database/rows/table/${params.table_id}/${params.row_id}/?user_field_names=true`, parsed)) as Record<string, unknown>;

    const lines = ['Ligne mise a jour avec succes :\n'];
    for (const [key, value] of Object.entries(data)) {
      if (key === 'order') continue;
      const display = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
      lines.push(`**${key}:** ${display}`);
    }

    return textResult(lines.join('\n'));
  },
);

// ── delete-row ───────────────────────────────────────────────

server.tool(
  'delete-row',
  'Delete a row from a Baserow table.',
  {
    table_id: z.number().describe('ID of the table'),
    row_id: z.number().describe('ID of the row to delete'),
  },
  async (params) => {
    await baserow('DELETE', `/api/database/rows/table/${params.table_id}/${params.row_id}/`);
    return textResult(`Ligne ${params.row_id} supprimee avec succes.`);
  },
);

// ── Start ─────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
