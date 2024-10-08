import { json } from '@sveltejs/kit';
import weaviate from 'weaviate-client'
import { Attachment, Message } from '$lib/types.js';
import { env } from '$lib/env';

export async function GET({ url }) {
	// get the params from url
	let messages: Message[] = [];
	let duck = url.searchParams.get('duck');
	let offset = parseInt(url.searchParams.get('offset') || '0', 10);
	if (duck ===  null || duck === '') return json({ messages });

    // let messages = [ '', '', '', '', '', '', '', '', '', '', '', '' ];

	const client = await weaviate.connectToLocal(
	{
		host: env.WEAVIATE,   // URL only, no http prefix
		port: 50080,
		grpcPort: 50051,     // Default is 50051, WCD uses 443
	});
	
	const messagesCollection = client.collections.get("Message");
	const results = await messagesCollection.query.fetchObjects({
		filters: messagesCollection.filter.byRef('belongsTo').byId().equal(duck),
		sort: messagesCollection.sort.byCreationTime(false),
		limit: 10,
		offset
	});

	const attachmentsCollection = client.collections.get("Attachment");
	for (const m of results.objects) {
		let message = Message.fromWeaviate(m);
		// get the possible attachments of the message
		const attachments = await attachmentsCollection.query.fetchObjects({
			filters: attachmentsCollection.filter.byRef('belongsTo').byId().equal(message.uuid),
			returnProperties: [ 'name', 'type' ]
		})
		for (const a of attachments.objects) {
			message.attachments.push(Attachment.fromWeaviate(a));
		}

		messages.push(message);
	}

	// get ai messages
	const answers = client.collections.get('Answer');
	const aiResults = await answers.query.fetchObjects({
		sort: answers.sort.byCreationTime(false),
		limit: 10,
		offset
	});

	// find oldest message date
	let oldest = new Date();
	for (const m of messages) {
		if (m.timestamp.getTime() < oldest.getTime()) {
			oldest = m.timestamp;
		}
	}
	
	for (const m of aiResults.objects) {
		let timestamp = new Date(m.properties.timestamp?.toString() || "");
		if (timestamp.getTime() < oldest.getTime()) {
			continue; // cant confirm order
		}

		let message = new Message(m.uuid, m.properties.from?.toString() || '', m.properties.content?.toString() || '', timestamp);

		messages.push(message);
	}

	// sort the messages by timestamp
	// i feel like sql handles this better
	messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

	return json({ messages });
}

export async function POST({ request, cookies }) {
	const data = await request.json();

	const client = await weaviate.connectToLocal(
	{
		host: env.WEAVIATE,   // URL only, no http prefix
		port: 50080,
		grpcPort: 50051,     // Default is 50051, WCD uses 443
	});

	const ducks = client.collections.get('Duck');
	const results = await ducks.query.fetchObjects({
		filters: ducks.filter.byId().equal(data.duck),
		returnProperties: ['name']
	});

	const messagesCollection = client.collections.get("Message");
	const timestamp = new Date();
	let uuid = await messagesCollection.data.insert({
        properties: {
			'from': 'user',
            'content': data.message,
            'timestamp': timestamp,
        },
        references: {
            'belongsTo': results.objects[0].uuid,
        }
    });

	return json({ message: new Message(uuid, 'user', data.message, timestamp) });
}
