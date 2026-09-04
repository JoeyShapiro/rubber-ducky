import type { Attachment, Message, Note, Quest, QuestStatus } from '$lib/types';

export function getCookie(name: string): string | undefined {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) {
        const part = parts.pop();
        if (!part) return undefined;
        return part.split(';').shift();
    }
}

export class ApiError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.status = status;
    }
}

/**
 * Every call to our own endpoints goes through here.
 *
 * The old code repeated a `.catch(err => if (err.status === 401) ...)` at each call site, but
 * most of those never fired: a rejected fetch gives you an Error, not a Response, so `err.status`
 * was undefined unless that particular call site also remembered to `throw res` itself. Handling
 * it in one place means an expired session actually bounces you to the login page.
 */
async function request<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, init);

    if (res.status === 401) {
        window.location.href = `${window.location.origin}/login`;
        throw new ApiError(401, 'Unauthorized');
    }

    if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new ApiError(res.status, detail || res.statusText);
    }

    return res.json();
}

function post<T>(url: string, body: unknown): Promise<T> {
    return request<T>(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
}

export function fetchMessages(duck: string, offset = 0): Promise<{ messages: Message[] }> {
    return request(`/messages?duck=${duck}&offset=${offset}`);
}

export function sendMessage(duck: string, message: string): Promise<{ message: Message }> {
    return post('/messages', { duck, message });
}

export function uploadAttachment(
    message: string,
    attachment: Attachment,
): Promise<{ message: string; attachment: Attachment }> {
    return post('/attachments', { message, attachment });
}

export function askQuestion(duck: string, prompt: string): Promise<{ message: Message }> {
    return post('/qna', { duck, prompt, session: getCookie('session') || '' });
}

export function fetchNotes(duck: string): Promise<{ notes: Note | null }> {
    return request(`/notes?duck=${duck}`);
}

export function saveNotes(duck: string, notes: string): Promise<{ uuid: string }> {
    return post('/notes', { duck, notes });
}

export function fetchQuests(duck: string): Promise<{ quests: Quest[] }> {
    return request(`/quests?duck=${duck}`);
}

export function createQuest(
    duck: string,
    quest: { title: string; description: string; due: string; quest_parent: string },
): Promise<{ quest: Quest }> {
    return post('/quests', { duck, ...quest });
}

export function setQuestStatus(
    uuid: string,
    status: QuestStatus,
    duck: string,
    title?: string,
): Promise<{ ok: boolean; systemMessage?: Message }> {
    return request('/quests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid, status, duck, title }),
    });
}
