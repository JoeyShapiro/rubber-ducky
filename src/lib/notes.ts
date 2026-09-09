import { Note } from '$lib/types';

/**
 * TEMPORARY in-memory note store for the T-07 design spike.
 *
 * Nothing here is persisted - everything is wiped on reload, and each duck is seeded with two
 * examples so the design is visible immediately. The function signatures deliberately mirror
 * `api.ts`, so swapping this for real endpoints is a substitution rather than a rewrite.
 *
 * Delete this file when T-07 lands for real.
 */
const byDuck = new Map<string, Note[]>();

function seed(): Note[] {
    return [
        new Note(crypto.randomUUID(), 'start command', '# dont forget to chmod\n./build.sh'),
        new Note(
            crypto.randomUUID(),
            'staging db',
            'psql -h staging.internal -U app rubber_ducky\npassword is in the vault under "staging/pg"',
        ),
    ];
}

export function listNotes(duck: string): Note[] {
    if (!byDuck.has(duck)) byDuck.set(duck, seed());
    return [...byDuck.get(duck)!];
}

export function createNote(duck: string): Note {
    const note = new Note(crypto.randomUUID(), '', '');
    byDuck.set(duck, [note, ...listNotes(duck)]);
    return note;
}

export function updateNote(duck: string, uuid: string, fields: { title: string; content: string }): Note | undefined {
    const notes = byDuck.get(duck);
    const note = notes?.find((n) => n.uuid === uuid);
    if (!note) return undefined;

    // only a real change counts as a modification, so an open-and-close does not touch the date
    if (note.title === fields.title && note.content === fields.content) return note;

    note.title = fields.title;
    note.content = fields.content;
    note.modified = new Date();
    return note;
}

export function deleteNote(duck: string, uuid: string): void {
    byDuck.set(duck, listNotes(duck).filter((n) => n.uuid !== uuid));
}
