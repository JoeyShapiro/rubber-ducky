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
