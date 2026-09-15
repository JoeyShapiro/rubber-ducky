import { json, error } from '@sveltejs/kit';
import { env } from '$lib/env';
import { db } from '$lib/db';
import { sessions } from '$lib/db/schema';

// How long a login lasts. Deliberately not renewed on activity: an expired session means logging
// in again, not a silent refresh. The draft you were typing is preserved across it ($lib/drafts).
const SESSION_HOURS = Number(env.SESSION_HOURS ?? 4);

export async function POST({ request, cookies, url }) {
	const data = await request.json();

	// the client hashes before this ever reaches the network (see login/+page.svelte) - this app
	// has no TLS, so the wire must never carry the real password. env.PASSWORD is that same hash.
	if (data.password !== env.PASSWORD) {
		return error(401, { message: 'Unauthorized' });
	}

	const expires = new Date(Date.now() + SESSION_HOURS * 60 * 60 * 1000);
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
