import { redirect } from '@sveltejs/kit';
import { building } from '$app/environment';
import { eq } from 'drizzle-orm';
import { db } from '$lib/db';
import { sessions } from '$lib/db/schema';
import { initEmbedding } from '$lib/embedding';
import { postSystemMessage } from '$lib/system';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The session cookie, if it names a row that exists and has not expired. */
async function validSession(id: string | undefined): Promise<string | null> {
	if (!id || !UUID.test(id)) return null;

	const [row] = await db.select().from(sessions).where(eq(sessions.id, id));
	if (!row) return null;
	if (row.expiresOn && row.expiresOn < new Date()) return null;

	return row.id;
}

let startupDone = false;

export async function handle({ event, resolve }) {
	if (!startupDone) {
		startupDone = true;
		try {
			const embeddingAvailable = await initEmbedding();
			await postSystemMessage('Server started');
			if (!embeddingAvailable) {
				await postSystemMessage(
					`Warning: embedding service unavailable (${process.env.OLLAMA_URL ?? 'http://localhost:11434'}) — semantic search disabled`,
				);
			}
		} catch (err) {
			console.error('[startup]', err);
		}
	}

	event.locals.session = null;

	// One guard for everything, rather than each endpoint remembering to check. Requests with no
	// matching route are static assets and 404s; /login has to be reachable while logged out.
	const isPublic = !event.route.id || event.url.pathname === '/login';

	if (!building && !isPublic) {
		const session = await validSession(event.cookies.get('session'));
		if (!session) {
			// a browser asking for a page should land on the login screen; an api call, which is
			// what everything else is, should simply hear 401
			if (event.request.headers.get('accept')?.includes('text/html')) {
				throw redirect(303, '/login');
			}
			return new Response(JSON.stringify({ error: 'Unauthorized' }), {
				status: 401,
				headers: { 'content-type': 'application/json' },
			});
		}
		event.locals.session = session;
	}

	return resolve(event);
}
