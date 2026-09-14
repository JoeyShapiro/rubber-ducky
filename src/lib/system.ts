import { db } from './db';
import { messages } from './db/schema';
import { Message } from './types';

export const SYSTEM_DUCK_ID = '00000000-0000-0000-0000-000000000002';

/**
 * Write a system entry into a duck's or badling's message log.
 *
 * The log is that scope's history, so anything that changes a quest or a note goes through here.
 * Returns the message so the endpoint can hand it back and the client can show it without
 * refetching; null if the write failed, since a failed log must never fail the action itself.
 *
 * Defaults to the Daemon duck, which is where server-level events (startup, imports) go.
 */
export async function postSystemMessage(content: string, parentId = SYSTEM_DUCK_ID): Promise<Message | null> {
	try {
		const timestamp = new Date();
		const [row] = await db.insert(messages).values({
			from: 'system',
			content,
			timestamp,
			parentId,
		}).returning();

		return new Message(row.id, 'system', content, timestamp);
	} catch (err) {
		console.error('[system] failed to post system message:', err);
		return null;
	}
}

/**
 * One shape for every log entry: what it is, which one, and what happened to it in words.
 *
 * The trailing word is load-bearing - Message.svelte colours entries by it (see
 * statusFromSystemMessage), so phrases end on created / added / modified / removed / a status.
 */
export function logLine(kind: 'Quest' | 'Note', name: string, phrase: string): string {
	return `${kind} ${name.trim() || 'Untitled'} ${phrase}`;
}
