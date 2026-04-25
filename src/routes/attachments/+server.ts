import { json } from '@sveltejs/kit';
import { Attachment } from '$lib/types';
import { db } from '$lib/db';
import { attachments as attachmentsTable } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST({ request }) {
	const data = await request.json();

	const [row] = await db.insert(attachmentsTable).values({
		name: data.attachment.name,
		type: data.attachment.type,
		content: data.attachment.content,
		messageId: data.message,
	}).returning();

	return json({ message: data.message, attachment: new Attachment(row.id, row.type ?? '', row.name ?? '', '') });
}

export async function GET({ url }) {
	const uuid = url.searchParams.get('uuid');
	if (!uuid) return json({ attachment: null });

	const [row] = await db.select().from(attachmentsTable).where(eq(attachmentsTable.id, uuid));
	if (!row) return json({ attachment: null });

	const type = (row.type ?? '').replace('data:', '');
	const content = row.content ?? '';

	const headers = new Headers();
	headers.set('Content-Disposition', 'attachment; filename=' + (row.name ?? ''));
	headers.set('Content-Type', type);

	const base64 = content.split(',')[1];
	const binaryString = atob(base64);
	const bytes = new Uint8Array(binaryString.length);
	for (let i = 0; i < binaryString.length; i++) {
		bytes[i] = binaryString.charCodeAt(i);
	}

	return new Response(bytes, { status: 200, headers });
}
