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
	const myCollection = client.collections.get("Badling");

	for await (let item of myCollection.iterator()) {
		let name = item.properties.name?.toString();
		if (name === undefined) continue;

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
