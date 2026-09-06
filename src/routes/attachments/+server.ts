import { json, error } from '@sveltejs/kit';
import { Attachment } from '$lib/types';
import { db } from '$lib/db';
import { attachments as attachmentsTable } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { decode, isCanonical, safeFilename } from '$lib/attachments';

export async function POST({ request }) {
	const data = await request.json();

	// hold the line on the canonical shape established in T-01, so no new drift gets in
	if (!isCanonical(data.attachment)) {
		return error(400, 'Attachment must have a name, a bare mime type, and a base64 data url');
	}

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
	if (!uuid) return error(400, 'Missing uuid');

	const [row] = await db.select().from(attachmentsTable).where(eq(attachmentsTable.id, uuid));
	if (!row) return error(404, 'Attachment not found');

	const decoded = decode(row.type ?? '', row.content ?? '');
	if (!decoded.ok) {
		console.error(`[attachments] ${uuid} (${row.name}) is undecodable: ${decoded.reason}`);
		return error(422, `Attachment "${row.name ?? uuid}" cannot be read: ${decoded.reason}`);
	}

	const headers = new Headers();
	headers.set('Content-Type', decoded.mime);
	headers.set('Content-Length', String(decoded.bytes.length));
	headers.set('Content-Disposition', `attachment; filename="${safeFilename(row.name, uuid)}"`);

	return new Response(decoded.bytes, { status: 200, headers });
}
