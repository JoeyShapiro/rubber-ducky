// A small in-memory, per-process rate limiter for login attempts. In-memory is fine here: this
// app runs as a single Bun process with no horizontal scaling, so there is nothing else to keep
// counters in sync with, and losing them on restart is an acceptable tradeoff for a personal app.
// See NOTES.md, 2026-09-15.

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 5 * 60 * 1000; // 5 minutes

const attempts = new Map<string, { count: number; windowStart: number }>();

/** Seconds until `key` may try again, or 0 if it isn't currently rate-limited. */
export function rateLimitedFor(key: string): number {
	const entry = attempts.get(key);
	if (!entry) return 0;

	const elapsed = Date.now() - entry.windowStart;
	if (elapsed > WINDOW_MS) {
		attempts.delete(key); // window's passed - stale entry, clean it up on the way out
		return 0;
	}

	if (entry.count < MAX_ATTEMPTS) return 0;
	return Math.ceil((WINDOW_MS - elapsed) / 1000);
}

/** Call once per failed attempt. */
export function recordFailedAttempt(key: string): void {
	const now = Date.now();
	const entry = attempts.get(key);

	if (!entry || now - entry.windowStart > WINDOW_MS) {
		attempts.set(key, { count: 1, windowStart: now });
	} else {
		entry.count++;
	}
}

/** Call on success - a real login clears the slate, so a typo streak doesn't linger. */
export function clearAttempts(key: string): void {
	attempts.delete(key);
}
