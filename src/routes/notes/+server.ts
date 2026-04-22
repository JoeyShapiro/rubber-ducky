import { json } from '@sveltejs/kit';
import weaviate from 'weaviate-client'
import { Note } from '$lib/types.js';
import { env } from '$lib/env';

export async function GET({ url }) {
	const duck = url.searchParams.get('duck');
	if (duck === null || duck === '') return json({ notes: null });

	const client = await weaviate.connectToLocal({
		host: env.WEAVIATE,
		port: 50080,
		grpcPort: 50051,
	});
	
	const notesCollection = client.collections.get("Note");
	const results = await notesCollection.query.fetchObjects({
		filters: notesCollection.filter.byRef('belongsTo').byId().equal(duck),
		sort: notesCollection.sort.byCreationTime(false),
	});

	if (results.objects.length === 0) return json({ notes: null });
	return json({ notes: Note.fromWeaviate(results.objects[0]) });
}

export async function POST({ request }) {
	const data = await request.json();

	if (!data.duck || data.notes === undefined) {
		return json({ error: 'Missing duck or notes' }, { status: 400 });
	}

	const client = await weaviate.connectToLocal({
		host: env.WEAVIATE,
		port: 50080,
		grpcPort: 50051,
	});

	const notesCollection = client.collections.get("Note");
	
	// Check if a note already exists for this duck
	const existingResults = await notesCollection.query.fetchObjects({
		filters: notesCollection.filter.byRef('belongsTo').byId().equal(data.duck),
	});

	let resultNote: Note;

	if (existingResults.objects.length > 0) {
		// Update existing note
		const existingNote = existingResults.objects[0];
		await notesCollection.data.update({
			id: existingNote.uuid,
			properties: {
				content: data.notes,
			},
		});
		resultNote = Note.fromWeaviate(existingNote);
		resultNote.content = data.notes;
	} else {
		// Create new note
		const ducks = client.collections.get('Duck');
		const duckResults = await ducks.query.fetchObjects({
			filters: ducks.filter.byId().equal(data.duck),
		});

		if (duckResults.objects.length === 0) {
			return json({ error: 'Duck not found' }, { status: 404 });
		}

		const uuid = await notesCollection.data.insert({
			properties: {
				content: data.notes,
			},
			references: {
				belongsTo: duckResults.objects[0].uuid,
			},
		});

		resultNote = new Note(uuid, data.notes);
	}

	return json({ uuid: resultNote.uuid });
}
