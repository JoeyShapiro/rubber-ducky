import { json } from '@sveltejs/kit';
import { Message } from '$lib/types.js';
import { db } from '$lib/db';
import { messages as messagesTable, answers } from '$lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { embed } from '$lib/embedding';

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

	const embedding = await embed(data.message);

	const [row] = await db.insert(messagesTable).values({
		from: 'user',
		content: data.message,
		timestamp,
		duckId: data.duck,
		...(embedding ? { embedding } : {}),
	}).returning();

	return json({ message: new Message(row.id, 'user', data.message, timestamp) });
}
