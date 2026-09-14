import { writable } from 'svelte/store';
import { Duck, Message, type Scope } from '$lib/types';

// which duck or badling is open. the sidebar writes it, everything else reads it
export const scope = writable<Scope>(new Duck('', ''));

// mobile only (see app.css's [data-screen] rules) - which of the four full-screen drawers is
// showing: the duck/badling list, the chat, or one of the two side panels. Desktop ignores this
// entirely and shows chat + notes + quests together, same as before. Not a route (2026-09-14,
// see NOTES.md decisions log) - this is the same kind of client state `scope` already is.
export type MobileView = 'sidebar' | 'chat' | 'notes' | 'quests';
export const mobileView = writable<MobileView>('sidebar');

// blur everything, for when someone is looking over your shoulder
export const hidden = writable(false);

export const darkMode = writable(false);

// shared because both the composer and the quest list append to the log
export const messages = writable<Message[]>([]);
