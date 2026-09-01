import { json, error } from '@sveltejs/kit';
import { Attachment } from '$lib/types';
import { db } from '$lib/db';
import { attachments as attachmentsTable } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

const DATA_URL = /^data:([^;,]*);base64,(.*)$/s;
const LEGACY_PAYLOAD = /^base64,(.*)$/s;
const BARE_MIME = /^[a-z]+\/[a-z0-9.+-]+$/i;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

type Decoded = { ok: true; mime: string; bytes: Buffer } | { ok: false; reason: string };

/**
 * Three encodings exist in this table (see docs/PLAN.md, T-02):
 *
 *   canonical      type "image/png"       content "data:image/png;base64,..."
 *   legacy paste   type "data:image/png"  content "base64,..."
 *   legacy picker  type "data:image/png;base64,..."  content "image/png"
 *
 * The last one had its constructor arguments swapped, so the payload landed in `type` and the
 * mime type in `content`. The bytes are there, just in the wrong column - read them anyway.
 */
function decode(type: string, content: string): Decoded {
	const swapped = DATA_URL.test(type);
	const payload = swapped ? type : content;
	const declared = (swapped ? content : type).replace(/^data:/, '').split(';')[0].trim();

	if (payload === '') {
		return { ok: false, reason: 'no content stored' };
	}
	// a column holding nothing but a mime type means the payload went missing entirely
	if (!swapped && BARE_MIME.test(payload)) {
		return { ok: false, reason: `content column holds a mime type ("${payload}"), not data` };
	}

	const asDataUrl = payload.match(DATA_URL);
	const asLegacy = payload.match(LEGACY_PAYLOAD);

	let mime = declared;
	let base64: string;

	if (asDataUrl) {
		mime = asDataUrl[1] || declared;
		base64 = asDataUrl[2];
	} else if (asLegacy) {
		base64 = asLegacy[1];
	} else if (!payload.includes(',')) {
		base64 = payload; // bare payload, no prefix at all
	} else {
		return { ok: false, reason: 'unrecognised encoding' };
	}

	base64 = base64.replace(/\s/g, '');
	if (base64 === '' || base64.length % 4 !== 0 || !BASE64.test(base64)) {
		return { ok: false, reason: 'payload is not valid base64' };
	}

	return {
		ok: true,
		mime: BARE_MIME.test(mime) ? mime : 'application/octet-stream',
		bytes: Buffer.from(base64, 'base64'),
	};
}

// header values cannot carry quotes, control characters, or non-ascii bytes.
// T-04 adds the inline/attachment split and rfc 5987 encoding for non-ascii names.
function safeFilename(name: string | null, fallback: string): string {
	const cleaned = (name ?? '').replace(/[^\x20-\x7e]/g, '').replace(/["\\]/g, '').trim();
	return cleaned || fallback;
}

export async function POST({ request }) {
	const data = await request.json();
	const incoming = data.attachment;

	// hold the line on the canonical shape established in T-01, so no new drift gets in
	if (!incoming?.name || !BARE_MIME.test(incoming.type ?? '') || !DATA_URL.test(incoming.content ?? '')) {
		return error(400, 'Attachment must have a name, a bare mime type, and a base64 data url');
	}

	const [row] = await db.insert(attachmentsTable).values({
		name: incoming.name,
		type: incoming.type,
		content: incoming.content,
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
