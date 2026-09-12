import { db } from './db';
import { messages } from './db/schema';
import { Message } from './types';

export const SYSTEM_DUCK_ID = '00000000-0000-0000-0000-000000000002';

/**
 * Write a system entry into a duck's message log.
 *
 * The log is the duck's history, so anything that changes a quest or a note goes through here.
 * Returns the message so the endpoint can hand it back and the client can show it without
 * refetching; null if the write failed, since a failed log must never fail the action itself.
 *
 * Defaults to the Daemon duck, which is where server-level events (startup, imports) go.
 */
export async function postSystemMessage(content: string, duckId = SYSTEM_DUCK_ID): Promise<Message | null> {
	try {
		const timestamp = new Date();
		const [row] = await db.insert(messages).values({
			from: 'system',
			content,
			timestamp,
			duckId,
		}).returning();

		return new Message(row.id, 'system', content, timestamp);
	} catch (err) {
		console.error('[system] failed to post system message:', err);
		return null;
	}
}

/**
 * One format for every entry, so the log reads consistently and the renderer can colour it by
 * the trailing verb (see statusFromSystemMessage / .system-log-* in Message.svelte).
 */
export function logLine(kind: 'Quest' | 'Note', title: string, verb: string): string {
	const name = title.trim() || 'Untitled';
	// real characters, not html entities: system entries render as plain text now, so an entity
	// would show up literally as "&ldquo;"
	return `${kind} “${name}” → ${verb}`;
}
