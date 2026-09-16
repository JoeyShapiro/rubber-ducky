import { json, error } from '@sveltejs/kit';
import { Quest, type QuestStatus, type Message } from '$lib/types.js';
import { db } from '$lib/db';
import { quests } from '$lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { logLine, postSystemMessage } from '$lib/system';
import { inferQuestStatus } from '$lib/quests';

type QuestStatusUpdate = { uuid: string; status: QuestStatus; done: boolean };

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

/**
 * Walks up from a quest that just changed, recomputing each ancestor's status from its own
 * children and stopping as soon as one is already correct (its ancestors can't have changed
 * either). This is a suggestion, not a lock: a parent's status can still be set by hand, and the
 * next child change will happily recompute over that manual value.
 */
async function propagateStatusUpward(startId: string, scopeParentId: string | undefined): Promise<{
	updatedQuests: QuestStatusUpdate[];
	ancestorMessages: Message[];
}> {
	const updatedQuests: QuestStatusUpdate[] = [];
	const ancestorMessages: Message[] = [];

	let current = startId;
	for (let hops = 0; hops < 20; hops++) {
		const [row] = await db
			.select({ questParentId: quests.questParentId })
			.from(quests)
			.where(eq(quests.id, current));
		const parentId = row?.questParentId;
		if (!parentId) break;

		const siblings = await db.select({ status: quests.status }).from(quests).where(eq(quests.questParentId, parentId));
		const inferred = inferQuestStatus(siblings.map(s => (s.status ?? 'inactive') as QuestStatus));

		const [parent] = await db.select().from(quests).where(eq(quests.id, parentId));
		if (!parent || parent.status === inferred) break;

		await db.update(quests).set({
			status: inferred,
			done: inferred === 'completed',
			updatedOn: new Date(),
		}).where(eq(quests.id, parentId));

		updatedQuests.push({ uuid: parentId, status: inferred, done: inferred === 'completed' });

		if (scopeParentId) {
			const message = await postSystemMessage(logLine('Quest', await pathOf(parentId), `looks ${inferred}`), scopeParentId);
			if (message) ancestorMessages.push(message);
		}

		current = parentId;
	}

	return { updatedQuests, ancestorMessages };
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

	// a new subquest can change its parent's inferred status (e.g. a completed parent is no
	// longer all-completed), so recompute up the chain even though the quest itself just started
	const { updatedQuests, ancestorMessages } = row.questParentId
		? await propagateStatusUpward(row.id, data.parent)
		: { updatedQuests: [], ancestorMessages: [] };

	return json({ quest, systemMessage, updatedQuests, ancestorMessages });
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

		const systemMessage = data.parent
			? await postSystemMessage(logLine('Quest', await pathOf(data.uuid), `is ${data.status}`), data.parent)
			: null;
		const { updatedQuests, ancestorMessages } = await propagateStatusUpward(data.uuid, data.parent);

		return json({ ok: true, systemMessage, updatedQuests, ancestorMessages });
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
