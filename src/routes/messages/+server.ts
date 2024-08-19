import { json } from '@sveltejs/kit';
import weaviate from 'weaviate-client'

export async function GET({ url }) {
	// get the params from url
	let duck = url.searchParams.get('duck');

    let messages = [ '', '', '', '', '', '', '', '', '', '', '', '' ];

	// const client = await weaviate.connectToLocal()

	// console.log(client)

	return json({ messages });
}
