import { json, error } from '@sveltejs/kit';
import { Note } from '$lib/types.js';
import { db } from '$lib/db';
import { notes as notesTable } from '$lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';

type Row = typeof notesTable.$inferSelect;

// db keeps the repo's createdOn/updatedOn naming; the client type says created/modified
function toNote(row: Row): Note {
	return new Note(row.id, row.title, row.content, row.createdOn, row.updatedOn);
}

export async function GET({ url }) {
	const duck = url.searchParams.get('duck');
	if (!duck) return json({ notes: [] });

	// most recently touched first, so a note you just wrote is at the top
	const rows = await db
		.select()
		.from(notesTable)
		.where(eq(notesTable.duckId, duck))
		.orderBy(desc(sql`coalesce(${notesTable.updatedOn}, ${notesTable.createdOn})`));

	return json({ notes: rows.map(toNote) });
}

export async function POST({ request }) {
	const data = await request.json();
	if (!data.duck) return error(400, 'Missing duck');

	// a new note starts empty and is filled in place - no dialog, no required title
	const [row] = await db.insert(notesTable).values({ duckId: data.duck }).returning();
	return json({ note: toNote(row) });
}

export async function PATCH({ request }) {
	const data = await request.json();
	if (!data.uuid) return error(400, 'Missing uuid');

	// the client only sends a PATCH when something actually changed, so updatedOn moving here
	// always means a real edit - which is what makes one log entry per edit honest (T-27)
	const [row] = await db
		.update(notesTable)
		.set({
			title: data.title ?? '',
			content: data.content ?? '',
			updatedOn: new Date(),
		})
		.where(eq(notesTable.id, data.uuid))
		.returning();

	if (!row) return error(404, 'Note not found');
	return json({ note: toNote(row) });
}

export async function DELETE({ url }) {
	const uuid = url.searchParams.get('uuid');
	if (!uuid) return error(400, 'Missing uuid');

	// deleting is the normal end of a note's life, not an exception
	await db.delete(notesTable).where(eq(notesTable.id, uuid));
	return json({ ok: true });
}
