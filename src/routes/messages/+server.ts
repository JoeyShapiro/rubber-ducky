import { json } from '@sveltejs/kit';

export function GET() {
    let messages = [ '', '', '', '', '', '', '', '', '', '', '', '' ];

	return json({ messages });
}
