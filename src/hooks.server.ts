import { initEmbedding } from '$lib/embedding';
import { postSystemMessage } from '$lib/system';

let startupDone = false;

export async function handle({ event, resolve }) {
	if (!startupDone) {
		startupDone = true;
		try {
			const embeddingAvailable = await initEmbedding();
			await postSystemMessage('Server started');
			if (!embeddingAvailable) {
				await postSystemMessage(
					`Warning: embedding service unavailable (${process.env.OLLAMA_URL ?? 'http://localhost:11434'}) — semantic search disabled`,
				);
			}
		} catch (err) {
			console.error('[startup]', err);
		}
	}
	return resolve(event);
}
