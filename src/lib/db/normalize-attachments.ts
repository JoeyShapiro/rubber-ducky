import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from './schema';
import { attachments } from './schema';
import { eq } from 'drizzle-orm';
import { decode, isNormalised } from '../attachments';

export type NormaliseReport = {
    total: number;
    alreadyCanonical: number;
    rewritten: number;
    failed: { id: string; name: string | null; reason: string }[];
};

/**
 * Rewrite every attachment into the canonical shape: `type` a bare mime, `content` a full
 * base64 data url.
 *
 * Three encodings accumulated in this table (see docs/NOTES.md). The endpoints read all of them,
 * which fixed the symptom but leaves every future reader having to know all three. This collapses
 * them, so the legacy branches in $lib/attachments.ts eventually have nothing left to handle.
 *
 * Rows are fetched one at a time on purpose - a single attachment can be megabytes, and loading
 * the whole table to normalise it would be a poor trade for a job that runs once.
 *
 * Undecodable rows are reported and left alone, never dropped. Safe to re-run; already-canonical
 * rows are skipped.
 */
export async function normalizeAttachments(
    db: PostgresJsDatabase<typeof schema>,
    { dryRun = false }: { dryRun?: boolean } = {},
): Promise<NormaliseReport> {
    const ids = await db.select({ id: attachments.id }).from(attachments);
    const report: NormaliseReport = { total: ids.length, alreadyCanonical: 0, rewritten: 0, failed: [] };

    for (const { id } of ids) {
        const [row] = await db.select().from(attachments).where(eq(attachments.id, id));
        if (!row) continue;

        const type = row.type ?? '';
        const content = row.content ?? '';

        if (isNormalised(type, content)) {
            report.alreadyCanonical++;
            continue;
        }

        const decoded = decode(type, content);
        if (!decoded.ok) {
            report.failed.push({ id: row.id, name: row.name, reason: decoded.reason });
            continue;
        }

        if (!dryRun) {
            await db
                .update(attachments)
                .set({
                    type: decoded.mime,
                    content: `data:${decoded.mime};base64,${decoded.bytes.toString('base64')}`,
                })
                .where(eq(attachments.id, row.id));
        }
        report.rewritten++;
    }

    return report;
}
