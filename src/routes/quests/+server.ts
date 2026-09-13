import { json } from '@sveltejs/kit';
import { Quest, type QuestStatus } from '$lib/types.js';
import { db } from '$lib/db';
import { quests } from '$lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { logLine, postSystemMessage } from '$lib/system';

/**
 * "top level / middle / this one" - the trail of titles down to a quest.
 *
 * Walks the parent chain rather than trusting a title from the client, so the log says where the
 * quest actually sits. Depth-capped in case questParentId ever forms a loop.
 */
async function pathOf(uuid: string): Promise<string> {
	const names: string[] = [];
	let current: string | null = uuid;

	for (let hops = 0; current && hops < 20; hops++) {
		const [row] = await db
			.select({ title: quests.title, parent: quests.questParentId })
			.from(quests)
			.where(eq(quests.id, current));
		if (!row) break;
		names.unshift(row.title?.trim() || 'Untitled');
		current = row.parent;
	}

	return names.join(' / ');
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
			r.createdOn,
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
		status: 'inactive',
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
		'inactive',
		false,
		null,
		row.createdOn,
	);

	const systemMessage = await postSystemMessage(logLine('Quest', await pathOf(row.id), 'was created'), data.duck);
	return json({ quest, systemMessage });
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
		const systemMessage = await postSystemMessage(logLine('Quest', await pathOf(data.uuid), `is ${data.status}`), data.duck);
		return json({ ok: true, systemMessage });
	}

	return json({ ok: true });
}
