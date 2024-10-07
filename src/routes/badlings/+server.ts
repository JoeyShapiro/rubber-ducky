import { json } from '@sveltejs/kit';
import weaviate from 'weaviate-client'
import { env } from '$lib/env';

export async function POST({ request }) {
	const data = await request.json();

	const client = await weaviate.connectToLocal(
	{
		host: env.WEAVIATE,   // URL only, no http prefix
		port: 50080,
		grpcPort: 50051,     // Default is 50051, WCD uses 443
	});

	// add new badling
    const badlings = client.collections.get('Badling');
    let uuid = await badlings.data.insert({
        properties: {
            'name': data.badling,
        }
    });

	// TODO return whole duck
	return json({ uuid });
}
