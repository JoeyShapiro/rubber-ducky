import { json, error } from '@sveltejs/kit';
import weaviate from 'weaviate-client'
import { env } from '$lib/env';

export async function POST({ request }) {
	const data = await request.json();
	// get password from env
	if (data.password !== env.PASSWORD) {
		return error(401, { message: 'Unauthorized' });
	}

	const client = await weaviate.connectToLocal(
	{
		host: env.WEAVIATE,   // URL only, no http prefix
		port: 50080,
		grpcPort: 50051,     // Default is 50051, WCD uses 443
	});

	// create the duck
	const expires = new Date(new Date().getTime() + 1000 * 60);
	const sessions = client.collections.get('Session');
	let uuid = await sessions.data.insert({
		properties: {
			'createdOn': new Date(),
			'expiresOn': expires
		}
	});

	// TODO return whole duck
	return json({ uuid, expiresOn: expires });
}
