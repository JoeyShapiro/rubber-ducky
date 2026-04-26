import { json } from '@sveltejs/kit';
import { db } from '$lib/db';
import {
	sessions,
	badlings,
	ducks,
	messages as messagesTable,
	attachments,
	answers,
	notes,
} from '$lib/db/schema';
import { postSystemMessage } from '$lib/system';

function chunk<T>(arr: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
	return out;
}

export async function POST({ request }) {
	try {
		return await doImport(request);
	} catch (err) {
		console.error('[import]', err);
		await postSystemMessage(`Import failed — ${String(err)}`);
		return json({ error: String(err) }, { status: 500 });
	}
}

async function doImport(request: Request) {
	let data: { collections: Record<string, any[]> };
	try {
		data = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	const cols = data.collections ?? {};
	const counts: Record<string, number> = {};

	// Sessions (no FK deps)
	if (cols.Session?.length) {
		let n = 0;
		for (const ch of chunk(
			cols.Session.map((s: any) => ({
				id: s.uuid,
				createdOn: s.createdOn ? new Date(s.createdOn) : null,
				expiresOn: s.expiresOn ? new Date(s.expiresOn) : null,
			})),
			500,
		)) {
			const r = await db.insert(sessions).values(ch).onConflictDoNothing().returning({ id: sessions.id });
			n += r.length;
		}
		counts.sessions = n;
	}

	// Badlings
	if (cols.Badling?.length) {
		let n = 0;
		for (const ch of chunk(
			cols.Badling.map((b: any) => ({
				id: b.uuid,
				name: b.name ?? null,
				description: b.description ?? null,
				createdOn: b.createdOn ? new Date(b.createdOn) : null,
			})),
			500,
		)) {
			const r = await db.insert(badlings).values(ch).onConflictDoNothing().returning({ id: badlings.id });
			n += r.length;
		}
		counts.badlings = n;
	}

	// Ducks (depends on Badlings)
	if (cols.Duck?.length) {
		let n = 0;
		for (const ch of chunk(
			cols.Duck.map((d: any) => ({
				id: d.uuid,
				name: d.name ?? null,
				description: d.description ?? null,
				createdOn: d.createdOn ? new Date(d.createdOn) : null,
				badlingId: d.belongsToId ?? null,
			})),
			500,
		)) {
			const r = await db.insert(ducks).values(ch).onConflictDoNothing().returning({ id: ducks.id });
			n += r.length;
		}
		counts.ducks = n;
	}

	// Messages (depends on Ducks)
	if (cols.Message?.length) {
		let n = 0;
		for (const ch of chunk(
			cols.Message.map((m: any) => ({
				id: m.uuid,
				from: m.from ?? null,
				content: m.content ?? null,
				timestamp: m.timestamp ? new Date(m.timestamp) : null,
				duckId: m.belongsToId,
			})),
			500,
		)) {
			const r = await db.insert(messagesTable).values(ch).onConflictDoNothing().returning({ id: messagesTable.id });
			n += r.length;
		}
		counts.messages = n;
	}

	// Attachments (depends on Messages)
	if (cols.Attachment?.length) {
		let n = 0;
		for (const ch of chunk(
			cols.Attachment.map((a: any) => ({
				id: a.uuid,
				name: a.name ?? null,
				type: a.type ?? null,
				content: a.content ?? null,
				messageId: a.belongsToId,
			})),
			500,
		)) {
			const r = await db.insert(attachments).values(ch).onConflictDoNothing().returning({ id: attachments.id });
			n += r.length;
		}
		counts.attachments = n;
	}

	// Answers
	if (cols.Answer?.length) {
		let n = 0;
		for (const ch of chunk(
			cols.Answer.map((a: any) => ({
				id: a.uuid,
				promt: a.promt ?? null,
				content: a.content ?? null,
				timestamp: a.timestamp ? new Date(a.timestamp) : null,
				messages: a.messages ?? null,
			})),
			500,
		)) {
			const r = await db.insert(answers).values(ch).onConflictDoNothing().returning({ id: answers.id });
			n += r.length;
		}
		counts.answers = n;
	}

	// Notes (depends on Ducks)
	if (cols.Note?.length) {
		let n = 0;
		for (const ch of chunk(
			cols.Note.map((n: any) => ({
				id: n.uuid,
				content: n.content ?? null,
				duckId: n.belongsToId,
			})),
			500,
		)) {
			const r = await db.insert(notes).values(ch).onConflictDoNothing().returning({ id: notes.id });
			n += r.length;
		}
		counts.notes = n;
	}

	const summary = Object.entries(counts)
		.filter(([, v]) => v > 0)
		.map(([k, v]) => `${v} ${k}`)
		.join(', ');
	await postSystemMessage(`Import complete — ${summary || 'nothing new'}`);

	return json({ imported: counts });
}
