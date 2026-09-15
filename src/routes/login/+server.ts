import { json, error } from '@sveltejs/kit';
import { createHmac } from 'node:crypto';
import { env } from '$lib/env';
import { db } from '$lib/db';
import { sessions } from '$lib/db/schema';

// How long a login lasts. Deliberately not renewed on activity: an expired session means logging
// in again, not a silent refresh. The draft you were typing is preserved across it ($lib/drafts).
const SESSION_HOURS = Number(env.SESSION_HOURS ?? 4);

export async function POST({ request, cookies, url }) {
	const data = await request.json();

	// The client sends a PBKDF2 derivation of the password, not the password itself (see
	// login/+page.svelte, $lib/authConfig.ts) - this app has no TLS, so the wire must never carry
	// the real password. From here it's treated the same way a server normally treats "the
	// password": peppered with a server-only secret (HMAC, since Bun's Argon2 wrapper has no
	// secret/K parameter of its own to pass one through), then verified against an Argon2id hash
	// - PASSWORD_HASH - via Bun's built-in Bun.password (no dependency; Argon2id is what OWASP
	// currently recommends for storage, and it embeds its own random salt).
	// hash-password.ts computes PASSWORD_HASH/PASSWORD_PEPPER the same way; see NOTES.md, 2026-09-15.
	const peppered = createHmac('sha256', env.PASSWORD_PEPPER ?? '').update(data.password ?? '').digest('hex');
	const ok = await Bun.password.verify(peppered, env.PASSWORD_HASH ?? '');
	if (!ok) {
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
