import { db } from './db';
import { messages } from './db/schema';

export const SYSTEM_DUCK_ID = '00000000-0000-0000-0000-000000000002';

export async function postSystemMessage(content: string): Promise<void> {
	try {
		await db.insert(messages).values({
			from: 'system',
			content,
			timestamp: new Date(),
			duckId: SYSTEM_DUCK_ID,
		});
	} catch (err) {
		console.error('[system] failed to post system message:', err);
	}
}
