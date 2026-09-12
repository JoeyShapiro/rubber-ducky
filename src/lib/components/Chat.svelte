<script lang="ts">
	import { tick } from 'svelte';
	import type { Duck } from '$lib/types';
	import { messages } from '$lib/stores';
	import { fetchMessages } from '$lib/api';
	import Message from './Message.svelte';
	import Composer from './Composer.svelte';

	export let duck: Duck;

	let chatbox: HTMLDivElement;
	let loading = false;
	let loadedDuck = '';

	$: if (duck.uuid !== loadedDuck) {
		loadedDuck = duck.uuid;
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
			await tick();
			scrollToBottom();
		} catch (err) {
			console.error('messages', err);
		} finally {
			loading = false;
		}
	}

	// scroll to the botton of the chat log
	function scrollToBottom() {
		chatbox?.lastElementChild?.scrollIntoView({ behavior: 'smooth' });
	}

	// keep pinned to the newest message as it arrives
	$: if ($messages.length) {
		tick().then(scrollToBottom);
	}
</script>

<div class="d-flex flex-column w-50 position-relative">
	<div bind:this={chatbox} id="chatbox" class="flex-column overflow-auto flex-fill fade-y">
		{#if loading}
			<div class="alert alert-info mt-2">Loading...</div>
		{/if}
		<!-- need the uuid to stop list oddness -->
		{#each $messages as message (message.uuid)}
			<Message {message} />
		{/each}
	</div>

	<Composer {duck} />
</div>
