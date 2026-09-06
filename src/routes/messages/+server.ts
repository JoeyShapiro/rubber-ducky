import { json } from '@sveltejs/kit';
import { Attachment, Message } from '$lib/types.js';
import { db } from '$lib/db';
import { messages as messagesTable, answers, attachments as attachmentsTable } from '$lib/db/schema';
import { eq, desc, inArray, sql } from 'drizzle-orm';
import { embed } from '$lib/embedding';
import { mimeOf } from '$lib/attachments';

/**
 * Hang each message's attachments off it, in one query rather than one per message.
 *
 * Only the first bytes of `type` and `content` are read. The base64 payload lives in `content`
 * normally, and in `type` for legacy swapped rows, so selecting either whole column would drag
 * megabytes out of postgres just to learn a mime type. The client gets metadata only and
 * fetches the bytes from GET /attachments by uuid.
 */
async function attachTo(msgs: Message[], ids: string[]) {
	if (ids.length === 0) return;

	const rows = await db
		.select({
			id: attachmentsTable.id,
			name: attachmentsTable.name,
			typeHead: sql<string>`left(${attachmentsTable.type}, 64)`,
			contentHead: sql<string>`left(${attachmentsTable.content}, 64)`,
			messageId: attachmentsTable.messageId,
		})
		.from(attachmentsTable)
		.where(inArray(attachmentsTable.messageId, ids));

	const byMessage = new Map<string, Attachment[]>();
	for (const row of rows) {
		const list = byMessage.get(row.messageId) ?? [];
		list.push(new Attachment(row.id, mimeOf(row.typeHead ?? '', row.contentHead ?? ''), row.name ?? '', ''));
		byMessage.set(row.messageId, list);
	}

	for (const msg of msgs) {
		msg.attachments = byMessage.get(msg.uuid) ?? [];
	}
}

export async function GET({ url }) {
	const duck = url.searchParams.get('duck');
	const offset = parseInt(url.searchParams.get('offset') || '0', 10);
	if (!duck) return json({ messages: [] });

	const rows = await db.select().from(messagesTable)
		.where(eq(messagesTable.duckId, duck))
		.orderBy(desc(messagesTable.timestamp))
		.limit(10)
		.offset(offset);

	const msgs: Message[] = rows.map(r =>
		new Message(r.id, r.from ?? '', r.content ?? '', r.timestamp ?? new Date())
	);

	await attachTo(msgs, rows.map(r => r.id));

	// Merge AI answers that fall within the same time window
	if (msgs.length > 0) {
		const oldest = msgs.reduce((a, b) => (a.timestamp < b.timestamp ? a : b)).timestamp;
		const answerRows = await db.select().from(answers).orderBy(desc(answers.timestamp));
		for (const a of answerRows) {
			const ts = a.timestamp ?? new Date();
			if (ts >= oldest) {
				msgs.push(new Message(a.id, 'ai', a.content ?? '', ts));
			}
		}
	}

	msgs.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
	return json({ messages: msgs });
}

export async function POST({ request }) {
	const data = await request.json();
	const timestamp = new Date();

	// an attachment-only message has no text worth embedding
	const embedding = data.message ? await embed(data.message) : null;

	const [row] = await db.insert(messagesTable).values({
		from: 'user',
		content: data.message,
		timestamp,
		duckId: data.duck,
		...(embedding ? { embedding } : {}),
	}).returning();

	return json({ message: new Message(row.id, 'user', data.message, timestamp) });
}
