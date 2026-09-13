/**
 * The message you were part-way through typing, kept per duck.
 *
 * A session expiring sends you back to the login screen on purpose - re-authenticating silently
 * would defeat the point - but losing an unsent message to it is just annoying. The draft is
 * written as you type, so it survives the redirect, a closed tab, or a crash.
 *
 * Text only. Staged attachments are base64 and would blow the storage quota.
 */
const key = (duck: string) => `rubber-ducky:draft:${duck}`;

// localStorage throws rather than returning null in some contexts (private windows, blocked
// site data), so every access is guarded - a lost draft must never break the composer.
export function loadDraft(duck: string): string {
    if (!duck || typeof localStorage === 'undefined') return '';
    try {
        return localStorage.getItem(key(duck)) ?? '';
    } catch {
        return '';
    }
}

export function saveDraft(duck: string, text: string): void {
    if (!duck || typeof localStorage === 'undefined') return;
    try {
        if (text.trim() === '') localStorage.removeItem(key(duck));
        else localStorage.setItem(key(duck), text);
    } catch {
        /* nothing useful to do; the draft is a convenience, not state we own */
    }
}

export function clearDraft(duck: string): void {
    saveDraft(duck, '');
}
