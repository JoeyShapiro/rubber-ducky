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

export async function GET({ url }) {
    let attachment: Attachment | null = null;

    let uuid = url.searchParams.get('uuid');
    if (uuid ===  null || uuid === '') return json({ attachment });

    const client = await weaviate.connectToLocal();
    const collection = client.collections.get("Attachment");
    const results = await collection.query.fetchObjects({
        filters: collection.filter.byId().equal(uuid)
    })

    if (results.objects.length === 0) return json({ attachment });
    attachment = Attachment.fromWeaviate(results.objects[0]);

    const headers = new Headers();
    headers.set("Content-Disposition", "attachment; filename="+attachment.name);
    headers.set("Content-Type", attachment.type);

    // convert base64 to binary
    attachment.content = atob(attachment.content.split(',')[1]);

    return new Response(new ReadableStream({
        start(controller) {
            controller.enqueue(attachment.content);
            controller.close();
        }
    }), {
        status: 200,
        headers: headers
    });
}
