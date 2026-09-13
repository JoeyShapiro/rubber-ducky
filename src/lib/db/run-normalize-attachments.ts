import 'dotenv/config';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema';
import { normalizeAttachments } from './normalize-attachments';

const dryRun = process.argv.includes('--dry-run');

const client = postgres({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: 5432,
    database: 'rubber_ducky',
    username: 'postgres',
    password: process.env.POSTGRES_PASSWORD,
});

const db = drizzle(client, { schema });
const report = await normalizeAttachments(db, { dryRun });

console.log(dryRun ? 'attachment normalise (dry run)' : 'attachment normalise');
console.log(`  ${report.total} attachments`);
console.log(`  ${report.alreadyCanonical} already canonical`);
console.log(`  ${report.rewritten} ${dryRun ? 'would be rewritten' : 'rewritten'}`);

if (report.failed.length) {
    console.log(`  ${report.failed.length} could not be decoded and were left untouched:`);
    for (const f of report.failed) console.log(`    ${f.id}  ${f.name ?? '(no name)'}  - ${f.reason}`);
}

await client.end();
