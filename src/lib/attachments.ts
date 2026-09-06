/**
 * Reading the three attachment encodings that exist in the database.
 *
 *   canonical      type "image/png"                  content "data:image/png;base64,..."
 *   legacy paste   type "data:image/png"             content "base64,..."
 *   legacy picker  type "data:image/png;base64,..."  content "image/png"
 *
 * The last one had its constructor arguments swapped before T-01, so the payload landed in
 * `type` and the mime type in `content`. The bytes are there, just in the wrong column.
 *
 * New rows are always canonical - POST /attachments rejects anything else - so these legacy
 * branches only ever see pre-existing data. T-22 normalises them away.
 */

const DATA_URL = /^data:([^;,]*);base64,(.*)$/s;
const LEGACY_PAYLOAD = /^base64,(.*)$/s;
const BARE_MIME = /^[a-z]+\/[a-z0-9.+-]+$/i;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

export type Decoded = { ok: true; mime: string; bytes: Buffer } | { ok: false; reason: string };

// the payload column and the mime column, whichever way round this row happens to be stored
function columns(type: string, content: string) {
    const swapped = DATA_URL.test(type);
    return { payload: swapped ? type : content, declared: swapped ? content : type, swapped };
}

/** The bare mime type, cheap enough to call on a whole page of messages. */
export function mimeOf(type: string, content: string): string {
    const { declared } = columns(type, content);
    const raw = declared.replace(/^data:/, '').split(';')[0].trim();
    return BARE_MIME.test(raw) ? raw : 'application/octet-stream';
}

/** What the client must send to POST /attachments - the canonical shape from T-01. */
export function isCanonical(attachment: { name?: string; type?: string; content?: string }): boolean {
    return Boolean(attachment?.name) && BARE_MIME.test(attachment.type ?? '') && DATA_URL.test(attachment.content ?? '');
}

export function decode(type: string, content: string): Decoded {
    const { payload, declared, swapped } = columns(type, content);

    if (payload === '') {
        return { ok: false, reason: 'no content stored' };
    }
    // a column holding nothing but a mime type means the payload went missing entirely
    if (!swapped && BARE_MIME.test(payload)) {
        return { ok: false, reason: `content column holds a mime type ("${payload}"), not data` };
    }

    const asDataUrl = payload.match(DATA_URL);
    const asLegacy = payload.match(LEGACY_PAYLOAD);

    let mime = declared.replace(/^data:/, '').split(';')[0].trim();
    let base64: string;

    if (asDataUrl) {
        mime = asDataUrl[1] || mime;
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

/**
 * A Content-Disposition value that will not throw and will not mangle the name.
 *
 * Header values cannot carry quotes, control characters, or non-ascii bytes, so the plain
 * `filename=` gets an ascii-only version and anything richer is repeated in the rfc 5987
 * `filename*=` form, which every current browser prefers.
 */
export function contentDisposition(name: string | null, fallback: string, inline: boolean): string {
    const raw = (name ?? '').replace(/[\r\n]/g, '').trim() || fallback;
    const ascii = raw.replace(/[^\x20-\x7e]/g, '').replace(/["\\]/g, '').trim() || fallback;

    let value = `${inline ? 'inline' : 'attachment'}; filename="${ascii}"`;
    if (raw !== ascii) {
        value += `; filename*=UTF-8''${encodeURIComponent(raw)}`;
    }
    return value;
}
