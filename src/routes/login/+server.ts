import { json, error } from '@sveltejs/kit';
import { env } from '$lib/env';
import { db } from '$lib/db';
import { sessions } from '$lib/db/schema';

export async function POST({ request }) {
	const data = await request.json();
	if (data.password !== env.PASSWORD) {
		return error(401, { message: 'Unauthorized' });
	}

	const expires = new Date(new Date().getTime() + 1000 * 60);
	const [session] = await db.insert(sessions).values({
		createdOn: new Date(),
		expiresOn: expires,
	}).returning();

	return json({ uuid: session.id, expiresOn: expires });
}
