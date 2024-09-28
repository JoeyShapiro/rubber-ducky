import { json } from '@sveltejs/kit';
import weaviate from 'weaviate-client'
import { Duck, Badling } from '$lib/types';

export async function GET() {
	let badlings: Badling[] = [];

	const client = await weaviate.connectToLocal();
	const badlingsCollection = client.collections.get("Badling");

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

	const client = await weaviate.connectToLocal();

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
