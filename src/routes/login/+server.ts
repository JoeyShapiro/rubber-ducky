import { json, error } from '@sveltejs/kit';
import { env } from '$lib/env';
import { db } from '$lib/db';
import { sessions } from '$lib/db/schema';

export async function POST({ request, cookies, url }) {
	const data = await request.json();
	if (data.password !== env.PASSWORD) {
		return error(401, { message: 'Unauthorized' });
	}

	const expires = new Date(new Date().getTime() + 1000 * 60);
	const [session] = await db.insert(sessions).values({
		createdOn: new Date(),
		expiresOn: expires,
	}).returning();

	// set here rather than by the client: httpOnly means page scripts cannot read or forge it,
	// which is the whole point of moving off document.cookie
	cookies.set('session', session.id, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		// this is served over plain http on a LAN, so secure would stop the cookie being sent at all
		secure: url.protocol === 'https:',
		expires,
	});

	return json({ ok: true });
}
