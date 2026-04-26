import { db } from './db';
import { badlings, ducks, messages } from './db/schema';

export const SYSTEM_BADLING_ID = '00000000-0000-0000-0000-000000000001';
export const SYSTEM_DUCK_ID = '00000000-0000-0000-0000-000000000002';

export async function ensureSystemDuck(): Promise<void> {
	await db.insert(badlings).values({
		id: SYSTEM_BADLING_ID,
		name: 'System',
		createdOn: new Date('2000-01-01'),
	}).onConflictDoNothing();

	await db.insert(ducks).values({
		id: SYSTEM_DUCK_ID,
		name: 'Daemon',
		description: 'System events, warnings, and logs',
		createdOn: new Date('2000-01-01'),
		badlingId: SYSTEM_BADLING_ID,
	}).onConflictDoNothing();
}

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
