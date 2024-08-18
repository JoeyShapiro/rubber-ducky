import { json } from '@sveltejs/kit';

export function GET({ url }) {
	// get the params from url
	let duck = url.searchParams.get('duck');

    let messages = [ '', '', '', '', '', '', '', '', '', '', '', '' ];

	return json({ messages });
}
