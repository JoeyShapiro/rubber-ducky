const OLLAMA_URL = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const EMBED_MODEL = 'nomic-embed-text';

let available = false;

export async function initEmbedding(): Promise<void> {
	try {
		const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ model: EMBED_MODEL, prompt: 'test' }),
		});
		if (!res.ok) throw new Error(`status ${res.status}`);
		available = true;
	} catch (e) {
		console.warn(`[embedding] nomic-embed-text unavailable — embeddings will be skipped. (${e})`);
		available = false;
	}
}

export async function embed(text: string): Promise<number[] | null> {
	if (!available) return null;
	try {
		const res = await fetch(`${OLLAMA_URL}/api/embeddings`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ model: EMBED_MODEL, prompt: text }),
		});
		const json = await res.json();
		return json.embedding as number[];
	} catch {
		return null;
	}
}
