import { json } from '@sveltejs/kit';
import { Message } from '$lib/types.js';
import { db } from '$lib/db';
import { answers } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const GEN_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2';

export async function POST({ request }) {
	const data = await request.json();

	let generated = '';
	const timestamp = new Date();

	try {
		const res = await fetch(`${OLLAMA_URL}/api/generate`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ model: GEN_MODEL, prompt: data.prompt, stream: false }),
		});

		if (res.status === 404) {
			return json({ error: `Model '${GEN_MODEL}' is not installed. Run: ollama pull ${GEN_MODEL}` }, { status: 503 });
		}
		if (!res.ok) {
			return json({ error: `Ollama error: ${res.status}` }, { status: 502 });
		}

		const result = await res.json();
		generated = result.response ?? '';
	} catch (e) {
		return json({ error: `Ollama unreachable: ${e}` }, { status: 503 });
	}

	const [row] = await db.insert(answers).values({
		promt: data.prompt,
		content: generated,
		timestamp,
		messages: null,
	}).returning();

	return json({ message: new Message(row.id, 'ai', generated, timestamp) });
}

export async function GET({ url }) {
	const uuid = url.searchParams.get('uuid');
	if (!uuid) return json({ message: null });

	const [row] = await db.select().from(answers).where(eq(answers.id, uuid));
	if (!row) return json({ message: null });

	return json({
		message: new Message(row.id, 'ai', row.content ?? '', row.timestamp ?? new Date()),
	});
}
