<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import type { Scope } from '$lib/types';
	import { messages } from '$lib/stores';
	import { fetchMessages } from '$lib/api';
	import Message from './Message.svelte';
	import Composer from './Composer.svelte';

	export let scope: Scope;

	const PAGE = 10; // matches the limit in GET /messages
	const LOOKAHEAD = '300px'; // how far above the viewport the sentinel starts the next fetch

	let chatbox: HTMLDivElement;
	let sentinel: HTMLDivElement;
	let observer: IntersectionObserver | undefined;
	let loading = false;
	let loadedScope = '';
	let exhausted = false;

	$: if (scope.uuid !== loadedScope) {
		loadedScope = scope.uuid;
		exhausted = false;
		seenTail = '';
		load(scope.uuid);
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
			// IntersectionObserver reports transitions, not state: if the sentinel is still in view
			// after this page (a short list, or a viewport that swallowed the whole page) no
			// further callback would ever come. Re-observing forces a fresh reading, so it keeps
			// filling until the viewport is covered - and stays quiet once the sentinel is above it.
			if (observer && sentinel) {
				observer.unobserve(sentinel);
				observer.observe(sentinel);
			}
		}
	}

	/** Fetch the page before the one we have and splice it on the front. */
	async function loadOlder() {
		if (loading || exhausted || !loadedScope || !chatbox) return;

		loading = true;
		const scopeId = loadedScope;

		try {
			// every loaded row is a messages-table row now that AI replies are posted as messages,
			// so the count is the offset - no filtering out a merged-in second source
			const offset = $messages.length;
			const data = await fetchMessages(scopeId, offset);
			if (loadedScope !== scopeId) return; // switched scope mid-flight

			if (data.messages.length < PAGE) exhausted = true;

			// belt and braces; pages no longer overlap, but a duplicate would be worse than a check
			const seen = new Set($messages.map((m) => m.uuid));
			const older = data.messages.filter((m) => !seen.has(m.uuid));
			if (older.length === 0) {
				exhausted = true;
				return;
			}

			// Measure immediately before the mutation, never before the fetch: the reader keeps
			// scrolling while the request is in flight, so anything captured earlier is stale.
			const beforeHeight = chatbox.scrollHeight;
			const beforeTop = chatbox.scrollTop;

			messages.update((list) => [...older, ...list]);
			await tick();

			// Unconditional, because `overflow-anchor: none` means nothing else touches the offset.
			// Chrome would otherwise anchor this itself and the two corrections would stack;
			// Safari has no scroll anchoring at all, so relying on it broke there completely.
			chatbox.scrollTop = beforeTop + (chatbox.scrollHeight - beforeHeight);
		} catch (err) {
			console.error('messages', err);
		} finally {
			loading = false;
		}
	}

	/**
	 * Watch a sentinel above the first message instead of listening to scroll.
	 *
	 * A scroll handler fires continuously and re-triggers while a fetch is still settling, which
	 * is how a single flick ended up pulling the entire log. The observer can only fire again
	 * once the sentinel has left the viewport and come back - so one page per trip to the top,
	 * however fast the scroll.
	 */
	$: if (sentinel && chatbox && !observer) {
		observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting)) loadOlder();
			},
			{ root: chatbox, rootMargin: `${LOOKAHEAD} 0px 0px 0px` },
		);
		observer.observe(sentinel);
	}

	onDestroy(() => observer?.disconnect());

	// scroll the log itself rather than scrollIntoView, which walks up to the nearest scrollable
	// ancestor and can drag the whole page with it
	function scrollToBottom(smooth = false) {
		if (!chatbox) return;
		chatbox.scrollTo({ top: chatbox.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
	}

	/**
	 * Follow the newest message, but only when there actually is a newer one.
	 *
	 * Keyed on the last message's uuid, not on `$messages` plus a flag: a reactive block re-runs
	 * when anything it reads changes, so reading a `prepending` flag in the condition meant
	 * clearing that flag re-fired the block and slammed the view back to the bottom. A prepend
	 * leaves the tail untouched, so this simply does not fire for it.
	 */
	let seenTail = '';
	$: tailUuid = $messages.length ? $messages[$messages.length - 1].uuid : '';
	$: if (tailUuid) followTail(tailUuid);

	function followTail(uuid: string) {
		const firstPaint = seenTail === '';
		if (uuid === seenTail) return;
		seenTail = uuid;
		tick().then(() => scrollToBottom(!firstPaint));
	}
</script>

<div class="d-flex flex-column w-50 position-relative">
	<div bind:this={chatbox} id="chatbox" class="flex-column overflow-auto flex-fill fade-y">
		{#if loading}
			<div class="chat-loading">Loading…</div>
		{/if}
		<div bind:this={sentinel} class="chat-sentinel" aria-hidden="true"></div>
		<!-- need the uuid to stop list oddness -->
		{#each $messages as message (message.uuid)}
			<Message {message} />
		{/each}
	</div>

	<Composer {scope} />
</div>

<style>
	/* Take the scroll offset entirely into our own hands. Chrome anchors content inserted above
	   the viewport and Safari does not, so leaving it to the browser means two different
	   behaviours; loadOlder restores the position itself instead. */
	#chatbox {
		overflow-anchor: none;
	}

	.chat-sentinel {
		height: 1px;
		flex-shrink: 0;
	}

	/* absolutely positioned: in the scroll flow it added and removed its own height mid-prepend,
	   shifting everything under it */
	.chat-loading {
		position: absolute;
		top: 0.4rem;
		left: 50%;
		transform: translateX(-50%);
		z-index: 2;
		font-size: 0.72rem;
		padding: 0.15rem 0.6rem;
		border-radius: 999px;
		background: rgba(120, 120, 140, 0.25);
		-webkit-backdrop-filter: blur(6px);
		backdrop-filter: blur(6px);
		color: rgba(108, 117, 125, 0.95);
	}
</style>
