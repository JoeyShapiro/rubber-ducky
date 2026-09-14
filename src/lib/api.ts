import { Note } from '$lib/types';
import type { Attachment, Message, Quest, QuestStatus } from '$lib/types';

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

export function fetchMessages(parent: string, offset = 0): Promise<{ messages: Message[] }> {
    return request(`/messages?parent=${parent}&offset=${offset}`);
}

export function sendMessage(parent: string, message: string): Promise<{ message: Message }> {
    return post('/messages', { parent, message });
}

export function uploadAttachment(
    message: string,
    attachment: Attachment,
): Promise<{ message: string; attachment: Attachment }> {
    return post('/attachments', { message, attachment });
}

export function askQuestion(parent: string, prompt: string): Promise<{ message: Message }> {
    return post('/qna', { parent, prompt });
}

// notes are the one type revived into real instances here: the component compares and sorts by
// their dates, and JSON hands them back as strings
export async function fetchNotes(parent: string): Promise<Note[]> {
    const data = await request<{ notes: unknown[] }>(`/notes?parent=${parent}`);
    return data.notes.map(Note.fromJSON);
}

export async function createNote(parent: string): Promise<Note> {
    const data = await post<{ note: unknown }>('/notes', { parent });
    return Note.fromJSON(data.note);
}

export async function updateNote(
    uuid: string,
    title: string,
    content: string,
): Promise<{ note: Note; systemMessage: Message | null }> {
    const data = await request<{ note: unknown; systemMessage: Message | null }>('/notes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid, title, content }),
    });
    return { note: Note.fromJSON(data.note), systemMessage: data.systemMessage };
}

export function deleteNote(uuid: string): Promise<{ ok: boolean; systemMessage: Message | null }> {
    return request(`/notes?uuid=${uuid}`, { method: 'DELETE' });
}

export function fetchQuests(parent: string): Promise<{ quests: Quest[] }> {
    return request(`/quests?parent=${parent}`);
}

export function createQuest(
    parent: string,
    quest: { title: string; description: string; due: string; quest_parent: string },
): Promise<{ quest: Quest; systemMessage: Message | null }> {
    return post('/quests', { parent, ...quest });
}

export function updateQuest(
    uuid: string,
    quest: { title: string; description: string; due: string },
    parent: string,
): Promise<{ quest: Quest; systemMessage: Message | null }> {
    return request('/quests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid, ...quest, parent }),
    });
}

export function setQuestStatus(
    uuid: string,
    status: QuestStatus,
    parent: string,
    title?: string,
): Promise<{ ok: boolean; systemMessage?: Message }> {
    return request('/quests', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid, status, parent, title }),
    });
}
