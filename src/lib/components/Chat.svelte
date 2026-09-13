<script lang="ts">
	import { tick } from 'svelte';
	import type { Duck } from '$lib/types';
	import { messages } from '$lib/stores';
	import { fetchMessages } from '$lib/api';
	import Message from './Message.svelte';
	import Composer from './Composer.svelte';

	export let duck: Duck;

	const PAGE = 10; // matches the limit in GET /messages
	const NEAR_TOP = 120;

	let chatbox: HTMLDivElement;
	let loading = false;
	let loadedDuck = '';
	let exhausted = false;
	// set while older messages are being spliced in, so the follow-the-newest rule stands down
	let prepending = false;

	$: if (duck.uuid !== loadedDuck) {
		loadedDuck = duck.uuid;
		exhausted = false;
		load(duck.uuid);
	}

	async function load(uuid: string) {
		if (!uuid) {
			messages.set([]);
			return;
		}

		loading = true;
		try {
			const data = await fetchMessages(uuid);
			messages.set(data.messages);
			exhausted = data.messages.length < PAGE;
			await tick();
			scrollToBottom();
		} catch (err) {
			console.error('messages', err);
		} finally {
			loading = false;
		}
	}

	/**
	 * Fetch the page before the one we have and splice it on the front.
	 *
	 * The offset counts only rows that came from the messages table: GET /messages merges AI
	 * answers in on top of its page, so `$messages.length` would over-skip (see T-15).
	 */
	async function loadOlder() {
		if (loading || exhausted || !loadedDuck || !chatbox) return;

		loading = true;
		prepending = true;

		// anchor the view so prepending does not yank it - without this the list jumps
		const beforeHeight = chatbox.scrollHeight;
		const beforeTop = chatbox.scrollTop;
		const duckId = loadedDuck;

		try {
			const offset = $messages.filter((m) => m.from !== 'ai').length;
			const data = await fetchMessages(duckId, offset);
			if (loadedDuck !== duckId) return; // switched ducks mid-flight

			if (data.messages.length < PAGE) exhausted = true;

			const seen = new Set($messages.map((m) => m.uuid));
			const older = data.messages.filter((m) => !seen.has(m.uuid));
			if (older.length === 0) {
				exhausted = true;
				return;
			}

			messages.update((list) => [...older, ...list]);
			await tick();
			chatbox.scrollTop = beforeTop + (chatbox.scrollHeight - beforeHeight);
		} catch (err) {
			console.error('messages', err);
		} finally {
			loading = false;
			prepending = false;
		}
	}

	function handleScroll() {
		if (chatbox && chatbox.scrollTop < NEAR_TOP) loadOlder();
	}

	// scroll to the botton of the chat log
	function scrollToBottom() {
		chatbox?.lastElementChild?.scrollIntoView({ behavior: 'smooth' });
	}

	// keep pinned to the newest message as it arrives, but not while older ones are going on top
	$: if ($messages.length && !prepending) {
		tick().then(() => {
			if (!prepending) scrollToBottom();
		});
	}
</script>

<div class="d-flex flex-column w-50 position-relative">
	<div
		bind:this={chatbox}
		on:scroll={handleScroll}
		id="chatbox"
		class="flex-column overflow-auto flex-fill fade-y"
	>
		{#if loading}
			<div class="chat-loading">Loading…</div>
		{/if}
		<!-- need the uuid to stop list oddness -->
		{#each $messages as message (message.uuid)}
			<Message {message} />
		{/each}
	</div>

	<Composer {duck} />
</div>

<style>
	.chat-loading {
		text-align: center;
		font-size: 0.75rem;
		color: rgba(108, 117, 125, 0.9);
		padding: 0.4rem;
	}
</style>
