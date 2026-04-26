import { initEmbedding } from '$lib/embedding';
import { ensureSystemDuck, postSystemMessage } from '$lib/system';

export async function init() {
	await ensureSystemDuck();

	const embeddingAvailable = await initEmbedding();

	await postSystemMessage('Server started');

	if (!embeddingAvailable) {
		await postSystemMessage(`Warning: embedding service unavailable (${process.env.OLLAMA_URL ?? 'http://localhost:11434'}) — semantic search disabled`);
	}
}
