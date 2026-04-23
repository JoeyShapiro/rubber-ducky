import { json } from '@sveltejs/kit';
import weaviate from 'weaviate-client';
import { Quest, Message, type QuestStatus } from '$lib/types.js';
import { env } from '$lib/env';
import { db } from '$lib/db';
import { quests } from '$lib/db/schema';
import { eq, desc } from 'drizzle-orm';

async function getClient() {
	return weaviate.connectToLocal({
		host: env.WEAVIATE,
		port: 50080,
		grpcPort: 50051,
	});
}

export async function GET({ url }) {
	const duck = url.searchParams.get('duck');
	if (!duck) return json({ quests: [] });

	try {
		const rows = await db.select().from(quests).where(eq(quests.duckId, duck)).orderBy(desc(quests.createdOn));
		const result = rows.map(r => new Quest(
			r.id,
			r.duckId,
			r.questParentId ?? '',
			r.title ?? '',
			r.description ?? '',
			r.due ?? '',
			(r.status ?? 'active') as QuestStatus,
			r.done ?? false,
			r.updatedOn,
		));
		return json({ quests: result });
	} catch {
		return json({ quests: [] });
	}
}

export async function POST({ request }) {
	const data = await request.json();

	if (!data.duck || !data.title) {
		return json({ error: 'Missing duck or title' }, { status: 400 });
	}

	const [row] = await db.insert(quests).values({
		title: data.title,
		description: data.description || '',
		due: data.due || '',
		status: 'active',
		done: false,
		createdOn: new Date(),
		questParentId: data.quest_parent || null,
		duckId: data.duck,
	}).returning();

	const quest = new Quest(
		row.id,
		row.duckId,
		row.questParentId ?? '',
		row.title ?? '',
		row.description ?? '',
		row.due ?? '',
		'active',
		false,
	);
	return json({ quest });
}

export async function PATCH({ request }) {
	const data = await request.json();

	if (!data.uuid || !data.status) {
		return json({ error: 'Missing uuid or status' }, { status: 400 });
	}

	await db.update(quests).set({
		status: data.status,
		done: data.status === 'completed',
		updatedOn: new Date(),
	}).where(eq(quests.id, data.uuid));

	if (data.duck) {
		const client = await getClient();
		const messagesCollection = client.collections.get('Message');
		const timestamp = new Date();
		const title = data.title || 'Quest';
		const content = `Quest &ldquo;${title}&rdquo; &rarr; ${data.status}`;
		const uuid = await messagesCollection.data.insert({
			properties: { from: 'system', content, timestamp },
			references: { belongsTo: data.duck },
		});
		return json({ ok: true, systemMessage: new Message(uuid, 'system', content, timestamp) });
	}

	return json({ ok: true });
}
