import { json } from '@sveltejs/kit';
import weaviate from 'weaviate-client';
import { Message } from '$lib/types.js';
import { env } from '$lib/env';
import { db } from '$lib/db';
import { answers } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

async function getClient() {
	return weaviate.connectToLocal({
		host: env.WEAVIATE,
		port: 50080,
		grpcPort: 50051,
	});
}

export async function POST({ request }) {
	const data = await request.json();

	let uuid = '';
	let timestamp = new Date(0);
	let generated = '';

	try {
		const client = await getClient();
		const messages = client.collections.get('Message');
		const result = await messages.generate.nearText(data.prompt, {
			groupedTask: data.prompt,
		}, {
			limit: 3,
		});

		const conns = JSON.stringify(
			result.objects.map(item => ({ uuid: item.uuid, dist: item.metadata?.distance }))
		);

		generated = result.generated || '';
		timestamp = new Date();

		const [row] = await db.insert(answers).values({
			promt: data.prompt,
			content: generated,
			timestamp,
			messages: conns,
		}).returning();

		uuid = row.id;
	} catch (error) {
		console.error(error);
		generated = `Error: ${error}`;
		timestamp = new Date();
	}

	return json({ message: new Message(uuid, 'ai', generated, timestamp) });
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
