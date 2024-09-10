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

export async function POST({ request }) {
	const data = await request.json();

	const client = await weaviate.connectToLocal();

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
