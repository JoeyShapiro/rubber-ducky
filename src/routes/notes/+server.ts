import { json, error } from '@sveltejs/kit';
import { Note, Message } from '$lib/types.js';
import { db } from '$lib/db';
import { notes as notesTable, messages as messagesTable } from '$lib/db/schema';
import { eq, desc, sql } from 'drizzle-orm';
import { logLine, postSystemMessage } from '$lib/system';
import { embed } from '$lib/embedding';

type Row = typeof notesTable.$inferSelect;

// db keeps the repo's createdOn/updatedOn naming; the client type says created/modified
function toNote(row: Row): Note {
	return new Note(row.id, row.title, row.content, row.createdOn, row.updatedOn);
}

export async function GET({ url }) {
	const parent = url.searchParams.get('parent');
	if (!parent) return json({ notes: [] });

	// most recently touched first, so a note you just wrote is at the top
	const rows = await db
		.select()
		.from(notesTable)
		.where(eq(notesTable.parentId, parent))
		.orderBy(desc(sql`coalesce(${notesTable.updatedOn}, ${notesTable.createdOn})`));

	return json({ notes: rows.map(toNote) });
}

export async function POST({ request }) {
	const data = await request.json();
	if (!data.parent) return error(400, 'Missing parent');

	// a new note starts empty and is filled in place - no dialog, no required title.
	// nothing is logged yet: the first save is what counts as adding it (see PATCH).
	const [row] = await db.insert(notesTable).values({ parentId: data.parent }).returning();
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
	const phrase = wasBlank ? 'was added' : 'was modified';
	const systemMessage = await postSystemMessage(logLine('Note', row.title, phrase), row.parentId);

	return json({ note: toNote(row), systemMessage });
}

/**
 * A note doesn't get deleted, it gets torn out: it leaves the notes list and its content lands
 * back in the log as an ordinary message, title folded in as a heading. Nothing is actually
 * lost, just moved somewhere less permanent - a note is a scratchpad you can tear a page from.
 */
export async function DELETE({ url }) {
	const uuid = url.searchParams.get('uuid');
	if (!uuid) return error(400, 'Missing uuid');

	// read it first: the title and content are needed to build the message, and gone after the delete
	const [row] = await db.select().from(notesTable).where(eq(notesTable.id, uuid));
	if (!row) return error(404, 'Note not found');

	const title = row.title.trim();
	const content = title ? `## ${title}\n\n${row.content}` : row.content;
	const timestamp = new Date();
	const embedding = content ? await embed(content) : null;

	const [messageRow] = await db.insert(messagesTable).values({
		from: 'user',
		content,
		timestamp,
		parentId: row.parentId,
		...(embedding ? { embedding } : {}),
	}).returning();

	await db.delete(notesTable).where(eq(notesTable.id, uuid));
	const systemMessage = await postSystemMessage(logLine('Note', row.title, 'was torn'), row.parentId);
	const message = new Message(messageRow.id, 'user', content, timestamp);

	return json({ ok: true, message, systemMessage });
}
