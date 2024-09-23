import { json } from '@sveltejs/kit';
import weaviate from 'weaviate-client'
import { Message } from '$lib/Message';
import { Attachment } from '$lib/types.js';

export async function GET({ url }) {
	// get the params from url
	let messages: Message[] = [];
	let duck = url.searchParams.get('duck');
	let offset = parseInt(url.searchParams.get('offset') || '0', 10);
	if (duck ===  null || duck === '') return json({ messages });

    // let messages = [ '', '', '', '', '', '', '', '', '', '', '', '' ];

	const client = await weaviate.connectToLocal();
	const messagesCollection = client.collections.get("Message");
	const results = await messagesCollection.query.fetchObjects({
		filters: messagesCollection.filter.byRef('belongsTo').byProperty("name").like(duck),
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

	// reverse the messages so the newest is first
	// i feel like sql handles this better
	messages = messages.reverse();

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
	const timestamp = new Date();
	let uuid = await messagesCollection.data.insert({
        properties: {
            'content': data.message,
            'timestamp': timestamp,
        },
        references: {
            'belongsTo': results.objects[0].uuid,
        }
    });

	return json({ message: new Message(uuid, data.message, timestamp) });
}
