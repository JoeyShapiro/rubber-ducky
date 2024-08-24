import { json } from '@sveltejs/kit';
import weaviate from 'weaviate-client'

export async function GET({ url }) {
	// get the params from url
	let messages: string[] = [];
	let duck = url.searchParams.get('duck');
	if (duck ===  null || duck === '') return json({ messages });

    // let messages = [ '', '', '', '', '', '', '', '', '', '', '', '' ];

	const client = await weaviate.connectToLocal();
	const messagesCollection = client.collections.get("Message");
	const results = await messagesCollection.query.fetchObjects({
		filters: messagesCollection.filter.byRef('belongsTo').byProperty("name").like(duck)
	})
	for (const m of results.objects) {
		messages.push(m.properties.content?.toString() || "");
	}

	return json({ messages });
}

export async function POST({ request, cookies }) {
	const data = await request.json();

	const client = await weaviate.connectToLocal();

	const ducks = client.collections.get('Duck');
	const results = await ducks.query.fetchObjects({
		filters: ducks.filter.byProperty("name").equal(data.duck),
		returnProperties: ['name']
	});

	const messagesCollection = client.collections.get("Message");
	let uuid = await messagesCollection.data.insert({
        properties: {
            'content': data.message,
            'timestamp': new Date(),
        },
        references: {
            'belongsTo': results.objects[0].uuid,
        }
    });

	return json({ uuid, message: data.message });
}
