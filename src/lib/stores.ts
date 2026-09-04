import { writable } from 'svelte/store';
import { Duck, Message } from '$lib/types';

// which duck is open. the sidebar writes it, everything else reads it
export const duck = writable(new Duck('', ''));

// blur everything, for when someone is looking over your shoulder
export const hidden = writable(false);

export const darkMode = writable(false);

// shared because both the composer and the quest list append to the log
export const messages = writable<Message[]>([]);
