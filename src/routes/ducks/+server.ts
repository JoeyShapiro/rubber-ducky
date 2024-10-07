import { json, error } from '@sveltejs/kit';
import weaviate from 'weaviate-client'
import { Duck, Badling } from '$lib/types';
import { env } from '$lib/env';

export async function GET({ request }) {
	let badlings: Badling[] = [];

	const client = await weaviate.connectToLocal(
	{
		host: env.WEAVIATE,   // URL only, no http prefix
		port: 50080,
		grpcPort: 50051,     // Default is 50051, WCD uses 443
	});
	
	const badlingsCollection = client.collections.get("Badling");

	const session = request.headers.get('session');
	const sesssions = client.collections.get('Session');
	if (session === null || session === '') {
		return error(401, { message: 'Unauthorized' });
	}

	const sessionResults = await sesssions.query.fetchObjects({
		filters: sesssions.filter.byId().equal(session)
	});
	if (sessionResults.objects.length === 0) {
		return error(401, { message: 'Unauthorized' });
	}
	if (sessionResults.objects[0]?.properties?.expiresOn && sessionResults.objects[0].properties.expiresOn < new Date()) {
		return error(401, { message: 'Unauthorized' });
	}

	for await (let item of badlingsCollection.iterator()) {
		let name = item.properties.name?.toString();
		if (name === undefined || name === '') continue;
		let uuid = item.uuid;

		badlings.push(new Badling(item.uuid, name));

		const ducks = client.collections.get('Duck');
		const results = await ducks.query.fetchObjects({
			filters: ducks.filter.byRef('belongsTo').byId().equal(uuid),
			returnProperties: ['name']
		})
		for (const duck of results.objects) {
			badlings[badlings.length - 1].ducks.push(new Duck(duck.uuid, duck.properties.name?.toString() || ""));
		}
	}

	return json({ badlings });
}

export async function POST({ request }) {
	const data = await request.json();

	const client = await weaviate.connectToLocal(
	{
		host: env.WEAVIATE,   // URL only, no http prefix
		port: 50080,
		grpcPort: 50051,     // Default is 50051, WCD uses 443
	});

	// get the badling
	const badlings = client.collections.get('Badling');
	const results = await badlings.query.fetchObjects({
		filters: badlings.filter.byId().equal(data.badling),
		returnProperties: ['name']
	});

	// create the duck
	const ducks = client.collections.get('Duck');
	let uuid = await ducks.data.insert({
		properties: {
			'name': data.duck,
			'createdOn': new Date(),
			'description': '',
		},
		references: {
			'belongsTo': results.objects[0].uuid,
		}
	});

	// TODO return whole duck
	return json({ uuid });
}
