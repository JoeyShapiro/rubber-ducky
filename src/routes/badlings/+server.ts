import { json } from '@sveltejs/kit';
import { db } from '$lib/db';
import { badlings } from '$lib/db/schema';

export async function POST({ request }) {
	const data = await request.json();

	const [row] = await db.insert(badlings).values({
		name: data.badling,
		createdOn: new Date(),
	}).returning();

	return json({ uuid: row.id });
}
