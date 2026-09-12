import { json, error } from '@sveltejs/kit';
import { Note } from '$lib/types.js';
import { db } from '$lib/db';
import { notes as notesTable } from '$lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { logLine, postSystemMessage } from '$lib/system';

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

	// a new note starts empty and is filled in place - no dialog, no required title.
	// nothing is logged yet: the first save is what counts as adding it (see PATCH).
	const [row] = await db.insert(notesTable).values({ duckId: data.duck }).returning();
	return json({ note: toNote(row) });
}

export async function PATCH({ request }) {
	const data = await request.json();
	if (!data.uuid) return error(400, 'Missing uuid');

	const [before] = await db.select().from(notesTable).where(eq(notesTable.id, data.uuid));
	if (!before) return error(404, 'Note not found');

	// the client only sends a PATCH when something actually changed, so updatedOn moving here
	// always means a real edit - which is what makes one log entry per edit honest
	const [row] = await db
		.update(notesTable)
		.set({
			title: data.title ?? '',
			content: data.content ?? '',
			updatedOn: new Date(),
		})
		.where(eq(notesTable.id, data.uuid))
		.returning();

	// filling in the empty shell POST created is the moment the note really came into being
	const wasBlank = before.title.trim() === '' && before.content.trim() === '';
	const verb = wasBlank ? 'added' : 'modified';
	const systemMessage = await postSystemMessage(logLine('Note', row.title, verb), row.duckId);

	return json({ note: toNote(row), systemMessage });
}

export async function DELETE({ url }) {
	const uuid = url.searchParams.get('uuid');
	if (!uuid) return error(400, 'Missing uuid');

	// read it first: the title and duck are needed for the log entry, and gone after the delete
	const [row] = await db.select().from(notesTable).where(eq(notesTable.id, uuid));
	if (!row) return error(404, 'Note not found');

	// deleting is the normal end of a note's life, not an exception. the log entry outlives the
	// note on purpose - the log is the history, so it still says what was removed.
	await db.delete(notesTable).where(eq(notesTable.id, uuid));
	const systemMessage = await postSystemMessage(logLine('Note', row.title, 'removed'), row.duckId);

	return json({ ok: true, systemMessage });
}
