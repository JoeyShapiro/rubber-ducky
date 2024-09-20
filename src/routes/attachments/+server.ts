import { json } from '@sveltejs/kit';
import weaviate from 'weaviate-client'
import { Attachment } from '$lib/types';

export async function POST({ request, cookies }) {
	const data = await request.json();

	const client = await weaviate.connectToLocal();

	const collection = client.collections.get("Attachment");
	let uuid = await collection.data.insert({
        properties: {
            'name': data.attachment.name,
            'type': data.attachment.type,
            'content': data.attachment.content,
        },
        references: {
            'belongsTo': data.message,
        }
    });

    // not sending the whole attachment back
	return json({ message: data.message, attachment: new Attachment(uuid, data.type, data.name, '') });
}
