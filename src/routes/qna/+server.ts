import { json } from '@sveltejs/kit';
import weaviate from 'weaviate-client'
import { Message } from '$lib/types.js';
import { env } from '$lib/env';

export async function POST({ request, cookies }) {
	const data = await request.json();

	const client = await weaviate.connectToLocal(
    {
        host: env.WEAVIATE,   // URL only, no http prefix
        port: 50080,
        grpcPort: 50051,     // Default is 50051, WCD uses 443
    });
    
    const messages = client.collections.get('Message');

    let uuid = '';
    let timestamp = new Date(0);
    let result = { generated: '' };
    try {
        const result = await messages.generate.nearText(data.prompt, {
            groupedTask: data.prompt
        },{
            limit: 3,
        });
    
        const conns = JSON.stringify(result.objects.map(item => ({ 'uuid': item.uuid, 'dist': item.metadata?.distance })));
    
        const timestamp = new Date();
        const answers = client.collections.get('Answer');
        uuid = await answers.data.insert({
            properties: {
                'prompt': data.prompt,
                'content': result.generated || '',
                'timestamp': timestamp,
                'messages': conns
            }
        });
    } catch (error) {
        console.error(error);
        result.generated = `Error: ${error}`;
        timestamp = new Date();
    }

	return json({ message: new Message(uuid, 'ai', result.generated || '', timestamp) });
}

export async function GET({ url }) {
    let message = null;

	// get the params from url
	let uuid = url.searchParams.get('uuid');
	let offset = parseInt(url.searchParams.get('offset') || '0', 10);
	if (uuid ===  null || uuid === '') return json({ message });

    // let messages = [ '', '', '', '', '', '', '', '', '', '', '', '' ];

	const client = await weaviate.connectToLocal(
    {
        host: env.WEAVIATE,   // URL only, no http prefix
        port: 50080,
        grpcPort: 50051,     // Default is 50051, WCD uses 443
    });

	const messagesCollection = client.collections.get("Message");
	const results = await messagesCollection.query.fetchObjects({
		filters: messagesCollection.filter.byRef('belongsTo').byId().equal(uuid),
		sort: messagesCollection.sort.byCreationTime(false),
		limit: 10,
		offset
	});

	return json({ message });
}
