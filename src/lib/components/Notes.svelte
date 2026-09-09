<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import type { Duck, Note } from '$lib/types';
	import { createNote, deleteNote, listNotes, updateNote } from '$lib/notes';
	import { formatDate } from '$lib/format';

	export let duck: Duck;

	let notes: Note[] = [];
	let openUuid: string | null = null;
	let filter = '';
	let loadedDuck = '';

	// editing buffers - the open note is not touched until the edit is committed
	let draftTitle = '';
	let draftContent = '';
	let titleInput: HTMLInputElement;
	let idleTimer: ReturnType<typeof setTimeout>;

	const IDLE_COMMIT_MS = 15000;

	$: if (duck.uuid !== loadedDuck) {
		commit();
		loadedDuck = duck.uuid;
		openUuid = null;
		filter = '';
		notes = duck.uuid ? listNotes(duck.uuid) : [];
	}

	$: open = notes.find((n) => n.uuid === openUuid) ?? null;
	$: dirty = open !== null && (draftTitle !== open.title || draftContent !== open.content);
	$: visible = notes
		.filter((n) => match(n, filter))
		.sort((a, b) => stamp(b) - stamp(a));

	function stamp(note: Note): number {
		return (note.modified ?? note.created).getTime();
	}

	function match(note: Note, needle: string): boolean {
		if (needle.trim() === '') return true;
		const q = needle.toLowerCase();
		return note.title.toLowerCase().includes(q) || note.content.toLowerCase().includes(q);
	}

	function displayTitle(note: Note): string {
		return note.title.trim() || 'Untitled';
	}

	/**
	 * Closing a note is the save. That gives a real `modified` date and one discrete event for
	 * the log (T-27) without a save button and without autosave firing per keystroke. Cmd/Ctrl-S
	 * commits without closing; a long idle timer catches you if you wander off mid-edit.
	 */
	function commit() {
		if (!open || !dirty) return;
		updateNote(loadedDuck, open.uuid, { title: draftTitle, content: draftContent });
		notes = listNotes(loadedDuck);
	}

	function touch() {
		clearTimeout(idleTimer);
		idleTimer = setTimeout(commit, IDLE_COMMIT_MS);
	}

	async function openNote(note: Note) {
		commit();
		draftTitle = note.title;
		draftContent = note.content;
		openUuid = note.uuid;
	}

	function close() {
		commit();
		clearTimeout(idleTimer);
		openUuid = null;
	}

	async function addNote() {
		if (!duck.uuid) return;
		commit();

		const note = createNote(duck.uuid);
		notes = listNotes(duck.uuid);
		draftTitle = '';
		draftContent = '';
		openUuid = note.uuid;

		await tick();
		titleInput?.focus();
	}

	function removeNote() {
		if (!open) return;
		deleteNote(loadedDuck, open.uuid);
		clearTimeout(idleTimer);
		openUuid = null;
		notes = listNotes(loadedDuck);
	}

	function handleKeydown(event: KeyboardEvent) {
		if ((event.ctrlKey || event.metaKey) && event.key === 's') {
			event.preventDefault();
			commit();
		}
		if (event.key === 'Escape') {
			close();
		}
	}

	onDestroy(() => {
		clearTimeout(idleTimer);
		commit();
	});
</script>

<div class="notes-container d-flex flex-column">
	<div class="notes-header d-flex justify-content-between align-items-center px-3 py-2 gap-2">
		{#if open}
			<div class="d-flex align-items-center gap-1 min-w-0">
				<button class="notes-crumb" type="button" on:click={close}>Notes</button>
				<span class="notes-crumb-sep">/</span>
				<span class="notes-crumb notes-crumb-current">{displayTitle(open)}</span>
				{#if dirty}<span class="notes-dirty" title="Unsaved">•</span>{/if}
			</div>
			<button class="notes-btn notes-btn-danger" type="button" on:click={removeNote}>Delete</button>
		{:else}
			<span class="notes-title fw-semibold">Notes</span>
			<button class="notes-btn" type="button" on:click={addNote} disabled={!duck.uuid}>New Note</button>
		{/if}
	</div>

	{#if open}
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div class="note-editor d-flex flex-column flex-fill p-3" on:keydown={handleKeydown}>
			<input
				bind:this={titleInput}
				bind:value={draftTitle}
				on:input={touch}
				class="note-title-input"
				placeholder="What is this called?"
				maxlength="120"
			/>
			<div class="note-meta">
				created {formatDate(open.created)}{#if open.modified} · edited {formatDate(open.modified)}{/if}
			</div>
			<textarea
				bind:value={draftContent}
				on:input={touch}
				class="note-content-input flex-fill mt-2"
				placeholder="The thing worth keeping around..."
			></textarea>
		</div>
	{:else}
		{#if notes.length > 1}
			<div class="px-3 pt-2">
				<input bind:value={filter} class="notes-filter" placeholder="Find a note" />
			</div>
		{/if}

		<ul class="notes-list list-unstyled m-0 p-3">
			{#each visible as note (note.uuid)}
				<li>
					<button class="note-item d-flex align-items-center gap-2 w-100" type="button" on:click={() => openNote(note)}>
						<span class="note-glyph" aria-hidden="true">▤</span>
						<span class="note-item-title flex-fill">{displayTitle(note)}</span>
						<span class="note-item-date">{formatDate(note.modified ?? note.created)}</span>
					</button>
				</li>
			{/each}

			{#if visible.length === 0}
				<li class="notes-empty">
					{#if notes.length === 0}
						Nothing kept yet. Notes are the things you will want to look up again.
					{:else}
						No note matches “{filter}”.
					{/if}
				</li>
			{/if}
		</ul>
	{/if}
</div>

<style>
	/* notes are shaped like quests but must not read like them: cool slate instead of the
	   amber/green status palette, an index-card stripe, and nothing that suggests completion */
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
		background: rgba(198, 205, 230, 0.5);
		border-bottom: 1px solid rgba(212, 212, 250, 0.4);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
	}

	.notes-title {
		color: rgba(0, 0, 0, 0.75);
		font-size: 0.9rem;
		user-select: none;
	}

	.min-w-0 {
		min-width: 0;
	}

	.notes-btn {
		font-size: 0.78rem;
		font-weight: 600;
		padding: 0.2rem 0.7rem;
		border-radius: 999px;
		border: 1px solid rgba(94, 106, 158, 0.45);
		background: rgba(255, 255, 255, 0.55);
		color: rgba(58, 66, 104, 0.95);
		cursor: pointer;
		white-space: nowrap;
	}

	.notes-btn:hover:not(:disabled) {
		background: rgba(255, 255, 255, 0.9);
	}

	.notes-btn:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.notes-btn-danger {
		border-color: rgba(220, 53, 69, 0.4);
		color: rgba(150, 40, 50, 0.95);
	}

	.notes-btn-danger:hover {
		background: rgba(220, 53, 69, 0.12);
	}

	.notes-crumb {
		font-size: 0.85rem;
		font-weight: 600;
		color: rgba(0, 0, 0, 0.55);
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 12rem;
	}

	.notes-crumb:hover {
		color: rgba(0, 0, 0, 0.85);
	}

	.notes-crumb-current {
		color: rgba(0, 0, 0, 0.8);
		cursor: default;
	}

	.notes-crumb-sep {
		font-size: 0.8rem;
		color: rgba(0, 0, 0, 0.3);
		flex-shrink: 0;
	}

	.notes-dirty {
		color: rgba(94, 106, 158, 0.9);
		font-size: 1.1rem;
		line-height: 1;
		flex-shrink: 0;
	}

	.notes-filter {
		width: 100%;
		font-size: 0.8rem;
		padding: 0.25rem 0.6rem;
		border-radius: 999px;
		border: 1px solid rgba(212, 212, 250, 0.6);
		background: rgba(255, 255, 255, 0.5);
	}

	.notes-filter:focus {
		outline: none;
		border-color: rgba(94, 106, 158, 0.6);
	}

	.notes-list {
		overflow-y: auto;
	}

	.note-item {
		text-align: left;
		background: rgba(255, 255, 255, 0.5);
		border: 1px solid rgba(212, 212, 250, 0.35);
		border-left: 3px solid rgba(94, 106, 158, 0.55);
		border-radius: 4px;
		padding: 0.55rem 0.75rem;
		margin-bottom: 0.4rem;
		cursor: pointer;
		transition: border-color 0.12s ease, background 0.12s ease;
	}

	.note-item:hover {
		background: rgba(255, 255, 255, 0.8);
		border-left-color: rgba(94, 106, 158, 0.95);
	}

	.note-glyph {
		color: rgba(94, 106, 158, 0.7);
		font-size: 0.8rem;
		flex-shrink: 0;
	}

	.note-item-title {
		font-size: 0.88rem;
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.note-item-date {
		font-size: 0.7rem;
		color: rgba(108, 117, 125, 0.85);
		white-space: nowrap;
		flex-shrink: 0;
	}

	.notes-empty {
		font-size: 0.82rem;
		color: rgba(108, 117, 125, 0.85);
		font-style: italic;
		padding: 0.5rem 0.25rem;
	}

	.note-title-input {
		font-size: 1rem;
		font-weight: 600;
		border: none;
		background: transparent;
		padding: 0;
		width: 100%;
	}

	.note-title-input:focus {
		outline: none;
	}

	.note-meta {
		font-size: 0.7rem;
		color: rgba(108, 117, 125, 0.8);
		margin-top: 0.15rem;
	}

	/* monospace because the content is usually a snippet, not prose */
	.note-content-input {
		font-family: 'GG Mono', 'Courier New', monospace;
		font-size: 0.84rem;
		line-height: 1.55;
		border: 1px solid rgba(212, 212, 250, 0.4);
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.4);
		padding: 0.6rem;
		resize: none;
		min-height: 0;
	}

	.note-content-input:focus {
		outline: none;
		border-color: rgba(94, 106, 158, 0.6);
	}

	:global(:root[data-theme="dark"]) .notes-header {
		background: rgba(52, 56, 72, 0.7);
	}

	:global(:root[data-theme="dark"]) .notes-title {
		color: rgba(232, 232, 232, 0.92);
	}

	:global(:root[data-theme="dark"]) .notes-btn {
		background: rgba(45, 45, 43, 0.8);
		border-color: rgba(140, 150, 195, 0.45);
		color: rgba(198, 205, 235, 0.95);
	}

	:global(:root[data-theme="dark"]) .notes-btn:hover:not(:disabled) {
		background: rgba(60, 60, 58, 0.9);
	}

	:global(:root[data-theme="dark"]) .notes-crumb,
	:global(:root[data-theme="dark"]) .notes-crumb-current {
		color: rgba(232, 232, 232, 0.85);
	}

	:global(:root[data-theme="dark"]) .note-item {
		background: rgba(35, 35, 33, 0.75);
		border-color: rgba(80, 80, 80, 0.45);
		border-left-color: rgba(140, 150, 195, 0.65);
	}

	:global(:root[data-theme="dark"]) .note-item:hover {
		background: rgba(45, 45, 43, 0.9);
	}

	:global(:root[data-theme="dark"]) .note-content-input,
	:global(:root[data-theme="dark"]) .notes-filter {
		background: rgba(25, 25, 24, 0.6);
		border-color: rgba(80, 80, 80, 0.5);
		color: var(--text-primary);
	}
</style>
