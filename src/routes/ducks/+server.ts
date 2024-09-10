import { json } from '@sveltejs/kit';
import weaviate from 'weaviate-client'

class Duck {
	constructor(public name: string) {
		this.name = name;
	}
}

// just make a class. it might be useful later
class Badling {
	ducks: Duck[];

	constructor(public name: string) {
		this.name = name;
		this.ducks = [];
	}
}

export async function GET() {
	let badlings: Badling[] = [];

	const client = await weaviate.connectToLocal();
	const badlingsCollection = client.collections.get("Badling");

	for await (let item of badlingsCollection.iterator()) {
		let name = item.properties.name?.toString();
		if (name === undefined || name === '') continue;

		badlings.push(new Badling(name));

		const ducks = client.collections.get('Duck');
		const results = await ducks.query.fetchObjects({
			filters: ducks.filter.byRef('belongsTo').byProperty("name").like(name),
			returnProperties: ['name']
		})
		for (const duck of results.objects) {
			badlings[badlings.length - 1].ducks.push(new Duck(duck.properties.name?.toString() || ""));
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
		filters: badlings.filter.byProperty("name").equal(data.badling),
		returnProperties: ['name']
	});

	// TODO check if duck already exists

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
