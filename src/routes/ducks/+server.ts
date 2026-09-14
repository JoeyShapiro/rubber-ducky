import { json } from '@sveltejs/kit';
import { db } from '$lib/db';
import { badlings as badlingsTable, ducks as ducksTable } from '$lib/db/schema';
import { Duck, Badling } from '$lib/types';

export async function GET() {
	// authentication is handled once, in hooks.server.ts
	const allBadlings = await db.select().from(badlingsTable);
	const allDucks = await db.select().from(ducksTable);

	const result: Badling[] = allBadlings.map(b => {
		const badling = new Badling(b.id, b.name ?? '');
		badling.ducks = allDucks
			.filter(d => d.badlingId === b.id)
			.map(d => new Duck(d.id, d.name ?? '', b.name ?? ''));
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
