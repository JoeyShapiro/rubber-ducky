import { writable } from 'svelte/store';
import { Duck } from '$lib/types';

// sidebar will write, page will read. so it's a shared store, rather than passing props
export const duck = writable(new Duck('', ''));
export const hidden = writable(false);
