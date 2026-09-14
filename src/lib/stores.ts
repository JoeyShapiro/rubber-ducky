import { writable } from 'svelte/store';
import { Duck, Message, type Scope } from '$lib/types';

// which duck or badling is open. the sidebar writes it, everything else reads it
export const scope = writable<Scope>(new Duck('', ''));

// blur everything, for when someone is looking over your shoulder
export const hidden = writable(false);

export const darkMode = writable(false);

// shared because both the composer and the quest list append to the log
export const messages = writable<Message[]>([]);
