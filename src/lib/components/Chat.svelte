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
			hydrateImages(data.messages);
			await tick();
			scrollToBottom();
		} catch (err) {
			console.error('messages', err);
		} finally {
			loading = false;
		}
	}

	/**
	 * Refetch each image as a blob and poke its src in by hand.
	 *
	 * This is dead code today - GET /messages never returns attachments, so the list is always
	 * empty (that is T-03). Once T-03 lands this will start running, and T-04 deletes it outright
	 * by serving images inline so the markup can just point at the url. Carried over unchanged so
	 * this refactor changes no behaviour.
	 */
	function hydrateImages(list: typeof $messages) {
		for (const message of list) {
			for (const attachment of message.attachments) {
				if (!attachment.type.includes('image')) continue;

				fetch(`/attachments?uuid=${attachment.uuid}`)
					.then((res) => res.blob())
					.then((blob) => {
						attachment.content = URL.createObjectURL(blob);

						// best i can think of
						// find the image and set the src
						const img = document.getElementById(attachment.uuid) as HTMLImageElement;
						if (img) {
							img.src = attachment.content;
							// Remember to revoke the URL when you're done with the image
							img.onload = () => URL.revokeObjectURL(attachment.content);
						} else {
							console.error(`Image ${attachment.uuid} not found`);
						}
					})
					.catch((err) => console.error('attachment', err));
			}
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
	<div bind:this={chatbox} id="chatbox" class="flex-column bg-body-tertiary overflow-auto flex-fill">
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
