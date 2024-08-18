import { writable } from 'svelte/store';

class Duck {
    /**
     * @param {any} name
     */
    constructor(name) {
        this.name = name;
    }
}

// sidebar will write, page will read. so it's a shared store, rather than passing props
export const duck = writable(new Duck(''));
