<script lang="ts">
	import type { Duck } from '$lib/types';
	import { fetchNotes, saveNotes } from '$lib/api';

	export let duck: Duck;

	let notes = '';
	let savedNotes = ''; // Track the last saved note content
	let loadedDuck = '';

	$: if (duck.uuid !== loadedDuck) {
		loadedDuck = duck.uuid;
		load(duck.uuid);
	}

	async function load(uuid: string) {
		if (!uuid) {
			notes = '';
			savedNotes = '';
			return;
		}

		try {
			const data = await fetchNotes(uuid);
			notes = data.notes ? data.notes.content : '';
			savedNotes = notes;
		} catch (err) {
			console.error('notes', err);
		}
	}

	async function handleSave() {
		if (!duck.uuid) return;

		try {
			await saveNotes(duck.uuid, notes);
			savedNotes = notes;
		} catch (err) {
			console.error('notes', err);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if ((event.ctrlKey || event.metaKey) && event.key === 's') {
			event.preventDefault();
			handleSave();
		}
	}
</script>

<!-- TODO add my own git db for this lol -->
<div class="notes-container d-flex flex-column">
	<div class="notes-header d-flex justify-content-between align-items-center px-3 py-2">
		<span class="notes-title fw-semibold">Notes</span>
		<button class="btn btn-sm btn-warning" on:click={handleSave} disabled={notes === savedNotes}>Save</button>
	</div>
	<textarea
		bind:value={notes}
		on:keydown={handleKeydown}
		class="notes-area flex-fill p-3"
		placeholder="Notes..."
	></textarea>
</div>

<style>
	.notes-container {
		background: rgba(248, 248, 255, 0.4);
		-webkit-backdrop-filter: blur(10px);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(212, 212, 250, 0.3);
		border-radius: 8px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
		overflow: hidden;
		min-height: 0;
		flex: 1 1 0;
	}

	.notes-header {
		background: rgba(212, 212, 250, 0.5);
		border-bottom: 1px solid rgba(212, 212, 250, 0.4);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
	}

	.notes-title {
		color: rgba(0, 0, 0, 0.75);
		font-size: 0.9rem;
		user-select: none;
	}

	.notes-area {
		background: transparent;
		border: none !important;
		border-radius: 0;
		font-size: 0.95rem;
		line-height: 1.6;
		transition: all 0.2s ease;
		resize: none;
		overflow-y: auto;
		min-height: 0;
	}

	.notes-area:focus {
		outline: none;
		background: rgba(255, 255, 255, 0.2);
	}

	.notes-area::placeholder {
		color: rgba(108, 117, 125, 0.5);
		font-style: italic;
	}
</style>
