import { json } from '@sveltejs/kit';
import weaviate from 'weaviate-client';
import { Quest, Message } from '$lib/types.js';
import { env } from '$lib/env';

async function getClient() {
	return weaviate.connectToLocal({
		host: env.WEAVIATE,
		port: 50080,
		grpcPort: 50051,
	});
}

export async function GET({ url }) {
	const duck = url.searchParams.get('duck');
	if (!duck) return json({ quests: [] });

	try {
		const client = await getClient();
		const questsCollection = client.collections.get('Quest');

		const results = await questsCollection.query.fetchObjects({
			filters: questsCollection.filter.byRef('belongsTo').byId().equal(duck),
			returnReferences: [{ linkOn: 'belongsTo' }],
			sort: questsCollection.sort.byCreationTime(false),
		});

		return json({ quests: results.objects.map(Quest.fromWeaviate) });
	} catch {
		return json({ quests: [] });
	}
}

export async function POST({ request }) {
	const data = await request.json();

	if (!data.duck || !data.title) {
		return json({ error: 'Missing duck or title' }, { status: 400 });
	}

	const client = await getClient();
	const questsCollection = client.collections.get('Quest');

	const uuid = await questsCollection.data.insert({
		properties: {
			title: data.title,
			description: data.description || '',
			due: data.due || '',
			status: 'active',
			done: false,
			createdOn: new Date(),
			questParentId: data.quest_parent || '',
		},
		references: {
			belongsTo: data.duck,
		},
	});

	const quest = new Quest(uuid, data.duck, data.quest_parent || '', data.title, data.description || '', data.due || '', 'active', false);
	return json({ quest });
}

export async function PATCH({ request }) {
	const data = await request.json();

	if (!data.uuid || !data.status) {
		return json({ error: 'Missing uuid or status' }, { status: 400 });
	}

	const client = await getClient();
	const questsCollection = client.collections.get('Quest');

	await questsCollection.data.update({
		id: data.uuid,
		properties: {
			status: data.status,
			done: data.status === 'completed',
			updatedOn: new Date(),
		},
	});

	if (data.duck) {
		const messagesCollection = client.collections.get('Message');
		const timestamp = new Date();
		const title = data.title || 'Quest';
		const content = `Quest &ldquo;${title}&rdquo; &rarr; ${data.status}`;
		const uuid = await messagesCollection.data.insert({
			properties: { from: 'system', content, timestamp },
			references: { belongsTo: data.duck },
		});
		return json({ ok: true, systemMessage: new Message(uuid, 'system', content, timestamp) });
	}

	return json({ ok: true });
}
