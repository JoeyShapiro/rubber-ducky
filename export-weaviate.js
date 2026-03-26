import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import weaviate from 'weaviate-client';

dotenv.config();

const DEFAULT_COLLECTIONS = [
  'Session',
  'Badling',
  'Duck',
  'Message',
  'Attachment',
  'Answer',
  'Note'
];

const RELATIONS = [
  { parent: 'Badling', child: 'Duck', fk: 'belongsToId' },
  { parent: 'Duck', child: 'Message', fk: 'belongsToId' },
  { parent: 'Message', child: 'Attachment', fk: 'belongsToId' },
  { parent: 'Duck', child: 'Note', fk: 'belongsToId' }
];

function parseArgs(argv) {
  const args = {
    outDir: 'exports',
    formats: new Set(['json', 'csv']),
    collections: [...DEFAULT_COLLECTIONS],
    pageSize: 200
  };

  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith('--outDir=')) {
      args.outDir = arg.split('=')[1] || args.outDir;
    } else if (arg.startsWith('--format=')) {
      const value = arg.split('=')[1] || '';
      args.formats = new Set(
        value
          .split(',')
          .map((v) => v.trim().toLowerCase())
          .filter((v) => v === 'json' || v === 'csv')
      );
      if (args.formats.size === 0) {
        args.formats = new Set(['json', 'csv']);
      }
    } else if (arg.startsWith('--collections=')) {
      const value = arg.split('=')[1] || '';
      const parsed = value
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean);
      if (parsed.length > 0) {
        args.collections = parsed;
      }
    } else if (arg.startsWith('--pageSize=')) {
      const value = Number.parseInt(arg.split('=')[1] || '', 10);
      if (Number.isFinite(value) && value > 0) {
        args.pageSize = value;
      }
    }
  }

  return args;
}

function toIso(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  return value;
}

function normalizeObject(obj) {
  const normalized = {
    uuid: obj.uuid
  };

  const props = obj.properties || {};
  for (const [key, value] of Object.entries(props)) {
    normalized[key] = toIso(value);
  }

  return normalized;
}

function csvEscape(value) {
  if (value === null || value === undefined) {
    return '';
  }

  const text =
    typeof value === 'string' ? value : Array.isArray(value) || typeof value === 'object' ? JSON.stringify(value) : String(value);

  if (text.includes('"') || text.includes(',') || text.includes('\n') || text.includes('\r')) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function toCsv(rows) {
  const keySet = new Set();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      keySet.add(key);
    }
  }

  const headers = Array.from(keySet).sort((a, b) => a.localeCompare(b));
  const uuidIndex = headers.indexOf('uuid');
  if (uuidIndex > 0) {
    headers.splice(uuidIndex, 1);
    headers.unshift('uuid');
  }

  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','));
  }

  return `${lines.join('\n')}\n`;
}

async function connectWithRetry(maxAttempts = 30) {
  const host = process.env.WEAVIATE;
  if (!host) {
    throw new Error('Missing WEAVIATE in environment (.env).');
  }

  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const client = await weaviate.connectToLocal({
        host,
        port: 50080,
        grpcPort: 50051
      });
      return client;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw new Error(`Unable to connect to Weaviate after ${maxAttempts} attempts: ${lastError?.message || 'unknown error'}`);
}

async function fetchCollection(client, name) {
  const collection = client.collections.get(name);
  const rows = [];

  for await (const obj of collection.iterator()) {
    rows.push(normalizeObject(obj));
  }

  return rows;
}

async function fetchChildrenByRef(childCollection, parentId, pageSize) {
  const childIds = [];
  let offset = 0;

  while (true) {
    const result = await childCollection.query.fetchObjects({
      filters: childCollection.filter.byRef('belongsTo').byId().equal(parentId),
      limit: pageSize,
      offset,
      returnProperties: []
    });

    for (const obj of result.objects) {
      childIds.push(obj.uuid);
    }

    if (result.objects.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return childIds;
}

async function flattenRelations(client, rowsByCollection, pageSize) {
  for (const relation of RELATIONS) {
    const parentRows = rowsByCollection[relation.parent];
    const childRows = rowsByCollection[relation.child];

    if (!parentRows || !childRows) {
      continue;
    }

    const childCollection = client.collections.get(relation.child);
    const childById = new Map(childRows.map((row) => [row.uuid, row]));

    for (const parent of parentRows) {
      const childIds = await fetchChildrenByRef(childCollection, parent.uuid, pageSize);
      for (const childId of childIds) {
        const row = childById.get(childId);
        if (row) {
          row[relation.fk] = parent.uuid;
        }
      }
    }
  }
}

function timestampSlug() {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const hh = String(now.getUTCHours()).padStart(2, '0');
  const min = String(now.getUTCMinutes()).padStart(2, '0');
  const sec = String(now.getUTCSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${min}${sec}`;
}

async function main() {
  const args = parseArgs(process.argv);
  const client = await connectWithRetry();

  const exportRoot = path.resolve(args.outDir, `weaviate-export-${timestampSlug()}`);
  const csvDir = path.join(exportRoot, 'csv');

  await fs.mkdir(exportRoot, { recursive: true });
  if (args.formats.has('csv')) {
    await fs.mkdir(csvDir, { recursive: true });
  }

  const rowsByCollection = {};
  const missingCollections = [];

  for (const name of args.collections) {
    try {
      rowsByCollection[name] = await fetchCollection(client, name);
      console.log(`Fetched ${rowsByCollection[name].length} rows from ${name}`);
    } catch (error) {
      missingCollections.push(name);
      console.warn(`Skipping ${name}: ${error.message}`);
    }
  }

  await flattenRelations(client, rowsByCollection, args.pageSize);

  if (args.formats.has('json')) {
    const payload = {
      exportedAt: new Date().toISOString(),
      source: {
        host: process.env.WEAVIATE,
        port: 50080,
        grpcPort: 50051
      },
      collections: rowsByCollection,
      missingCollections
    };

    const jsonPath = path.join(exportRoot, 'weaviate-export.json');
    await fs.writeFile(jsonPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(`Wrote ${jsonPath}`);
  }

  if (args.formats.has('csv')) {
    for (const [name, rows] of Object.entries(rowsByCollection)) {
      const csvPath = path.join(csvDir, `${name}.csv`);
      await fs.writeFile(csvPath, toCsv(rows), 'utf8');
      console.log(`Wrote ${csvPath}`);
    }
  }

  console.log(`Export complete: ${exportRoot}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});