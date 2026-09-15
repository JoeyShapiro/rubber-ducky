// Not secret - a salt's only job is to defeat precomputed rainbow tables, and this app has
// exactly one password to defend, not one per account, so a single fixed salt is enough. Safe to
// ship in the client bundle and to hardcode in the setup script; regenerating it would just
// invalidate the stored hash, the same as changing the password would.
export const PBKDF2_SALT = 'eb6eb0221e1a65ee0415abb91ff3ee39';

// OWASP's current PBKDF2-HMAC-SHA256 minimum (Password Storage Cheat Sheet, 2023 revision).
export const PBKDF2_ITERATIONS = 600_000;

export const PBKDF2_KEY_LENGTH = 32; // bytes

/**
 * What the browser sends over the wire instead of the real password, and what hash-password.ts
 * (the setup script) needs to reproduce to compute PASSWORD_HASH for .env. Deliberately the same
 * function in both places - two separate reimplementations of "the same" KDF call is exactly how
 * a salt or iteration count quietly drifts out of sync and every login starts failing.
 *
 * Real window.crypto.subtle (native PBKDF2 via deriveBits), not a JS library standing in for it.
 * SubtleCrypto only exists in a secure context - https, or the special-cased http://localhost -
 * so this throws rather than silently falling back to something weaker on a plain-http origin.
 * The fix is to serve over https (the dev server does, with a self-signed cert - see
 * vite.config.ts; production is expected to have real TLS), not to route around the check.
 * Bun's own runtime always has crypto.subtle regardless (no browser to gate it), so this same
 * function works unmodified in hash-password.ts. See NOTES.md, 2026-09-15.
 */
export async function deriveLoginKey(password: string): Promise<string> {
	if (!globalThis.crypto?.subtle) {
		throw new Error(
			'crypto.subtle is unavailable - this page needs to be loaded over https:// to log in. ' +
				'A plain http:// origin (other than localhost) never has it.',
		);
	}

	const enc = new TextEncoder();
	const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
		'deriveBits',
	]);
	const derived = await crypto.subtle.deriveBits(
		{ name: 'PBKDF2', salt: enc.encode(PBKDF2_SALT), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
		keyMaterial,
		PBKDF2_KEY_LENGTH * 8,
	);

	return Array.from(new Uint8Array(derived))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}
