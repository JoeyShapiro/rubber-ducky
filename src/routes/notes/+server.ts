import { json } from '@sveltejs/kit';
import { Note } from '$lib/types.js';
import { db } from '$lib/db';
import { notes as notesTable } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET({ url }) {
	const duck = url.searchParams.get('duck');
	if (!duck) return json({ notes: null });

	const [row] = await db.select().from(notesTable).where(eq(notesTable.duckId, duck));
	if (!row) return json({ notes: null });

	return json({ notes: new Note(row.id, row.content ?? '') });
}

export async function POST({ request }) {
	const data = await request.json();

	if (!data.duck || data.notes === undefined) {
		return json({ error: 'Missing duck or notes' }, { status: 400 });
	}

	const [existing] = await db.select().from(notesTable).where(eq(notesTable.duckId, data.duck));

	if (existing) {
		await db.update(notesTable).set({ content: data.notes }).where(eq(notesTable.id, existing.id));
		return json({ uuid: existing.id });
	}

	const [row] = await db.insert(notesTable).values({
		content: data.notes,
		duckId: data.duck,
	}).returning();

	return json({ uuid: row.id });
}
