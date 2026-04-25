import { json, error } from '@sveltejs/kit';
import { db } from '$lib/db';
import { badlings as badlingsTable, ducks as ducksTable, sessions } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { Duck, Badling } from '$lib/types';

export async function GET({ request }) {
	const sessionId = request.headers.get('session');
	if (!sessionId) return error(401, { message: 'Unauthorized' });

	const [sess] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
	if (!sess || (sess.expiresOn && sess.expiresOn < new Date())) {
		return error(401, { message: 'Unauthorized' });
	}

	const allBadlings = await db.select().from(badlingsTable);
	const allDucks = await db.select().from(ducksTable);

	const result: Badling[] = allBadlings.map(b => {
		const badling = new Badling(b.id, b.name ?? '');
		badling.ducks = allDucks
			.filter(d => d.badlingId === b.id)
			.map(d => new Duck(d.id, d.name ?? ''));
		return badling;
	});

	return json({ badlings: result });
}

export async function POST({ request }) {
	const data = await request.json();

	const [row] = await db.insert(ducksTable).values({
		name: data.duck,
		description: '',
		createdOn: new Date(),
		badlingId: data.badling,
	}).returning();

	return json({ uuid: row.id });
}
