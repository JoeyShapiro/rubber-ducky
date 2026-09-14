import { json, error } from '@sveltejs/kit';
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
	const parent = url.searchParams.get('parent');
	if (!parent) return json({ quests: [] });

	try {
		const rows = await db.select().from(quests).where(eq(quests.parentId, parent)).orderBy(desc(quests.createdOn));
		const result = rows.map(r => new Quest(
			r.id,
			r.parentId,
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

	if (!data.parent || !data.title) {
		return json({ error: 'Missing parent or title' }, { status: 400 });
	}

	const [row] = await db.insert(quests).values({
		title: data.title,
		description: data.description || '',
		due: data.due || '',
		status: 'inactive',
		done: false,
		createdOn: new Date(),
		questParentId: data.quest_parent || null,
		parentId: data.parent,
	}).returning();

	const quest = new Quest(
		row.id,
		row.parentId,
		row.questParentId ?? '',
		row.title ?? '',
		row.description ?? '',
		row.due ?? '',
		'inactive',
		false,
		null,
		row.createdOn,
	);

	const systemMessage = await postSystemMessage(logLine('Quest', await pathOf(row.id), 'was created'), data.parent);
	return json({ quest, systemMessage });
}

export async function PATCH({ request }) {
	const data = await request.json();

	if (!data.uuid) {
		return json({ error: 'Missing uuid' }, { status: 400 });
	}

	// two distinct actions share this route: a status change (existing), or an edit of the
	// quest's own content. Kept apart rather than merged into one "arbitrary field update" so
	// each can log its own, more honest phrase.
	if (data.status) {
		await db.update(quests).set({
			status: data.status,
			done: data.status === 'completed',
			updatedOn: new Date(),
		}).where(eq(quests.id, data.uuid));

		if (data.parent) {
			const systemMessage = await postSystemMessage(logLine('Quest', await pathOf(data.uuid), `is ${data.status}`), data.parent);
			return json({ ok: true, systemMessage });
		}

		return json({ ok: true });
	}

	if (!data.title) {
		return json({ error: 'Missing status or title' }, { status: 400 });
	}

	const [row] = await db.update(quests).set({
		title: data.title,
		description: data.description ?? '',
		due: data.due ?? '',
		updatedOn: new Date(),
	}).where(eq(quests.id, data.uuid)).returning();

	if (!row) return error(404, 'Quest not found');

	const quest = new Quest(
		row.id,
		row.parentId,
		row.questParentId ?? '',
		row.title ?? '',
		row.description ?? '',
		row.due ?? '',
		(row.status ?? 'active') as QuestStatus,
		row.done ?? false,
		row.updatedOn,
		row.createdOn,
	);

	const systemMessage = data.parent
		? await postSystemMessage(logLine('Quest', await pathOf(row.id), 'was modified'), data.parent)
		: null;

	return json({ quest, systemMessage });
}
