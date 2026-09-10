<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import { Note, type Duck } from '$lib/types';
	import { createNote, deleteNote, fetchNotes, updateNote } from '$lib/api';
	import { formatDate } from '$lib/format';
	import { enhanceMarkdown, renderMarkdown } from '$lib/markdown';
	import ConfirmDialog from './ConfirmDialog.svelte';

	export let duck: Duck;

	let notes: Note[] = [];
	let openUuid: string | null = null;
	let loading = false;
	let loadedDuck = '';
	let confirmingDelete = false;
	// a note is read far more often than it is written, so reading is the default mode
	let editing = false;

	// editing buffers - the open note is not touched until the edit is committed
	let draftTitle = '';
	let draftContent = '';
	let titleInput: HTMLInputElement;
	let idleTimer: ReturnType<typeof setTimeout>;

	const IDLE_COMMIT_MS = 15000;

	$: if (duck.uuid !== loadedDuck) {
		commit(); // captures the outgoing duck synchronously, before loadedDuck moves
		loadedDuck = duck.uuid;
		openUuid = null;
		editing = false;
		load(duck.uuid);
	}

	$: open = notes.find((n) => n.uuid === openUuid) ?? null;
	$: dirty = open !== null && (draftTitle !== open.title || draftContent !== open.content);
	$: ordered = [...notes].sort((a, b) => stamp(b) - stamp(a));
	$: rendered = open && !editing ? renderMarkdown(open.content) : '';

	function stamp(note: Note): number {
		return (note.modified ?? note.created).getTime();
	}

	function displayTitle(note: Note): string {
		return note.title.trim() || 'Untitled';
	}

	async function load(uuid: string) {
		if (!uuid) {
			notes = [];
			return;
		}

		loading = true;
		try {
			const list = await fetchNotes(uuid);
			if (loadedDuck === uuid) notes = list;
		} catch (err) {
			console.error('notes', err);
		} finally {
			loading = false;
		}
	}

	/**
	 * Closing a note is the save. That gives a real `modified` date and one discrete event for
	 * the log (T-27) without a save button and without autosave firing per keystroke. Cmd/Ctrl-S
	 * commits without closing; a long idle timer catches you if you wander off mid-edit.
	 *
	 * Everything it needs is captured synchronously, so it stays correct if the duck changes
	 * while the request is in flight.
	 */
	async function commit() {
		const note = open;
		if (!note || !dirty) return;

		const duckId = loadedDuck;
		const title = draftTitle;
		const content = draftContent;

		try {
			const saved = await updateNote(note.uuid, title, content);
			if (loadedDuck !== duckId) return; // moved on while saving
			notes = notes.map((n) => (n.uuid === saved.uuid ? saved : n));
		} catch (err) {
			console.error('notes', err);
		}
	}

	function touch() {
		clearTimeout(idleTimer);
		idleTimer = setTimeout(commit, IDLE_COMMIT_MS);
	}

	function openNote(note: Note) {
		commit();
		draftTitle = note.title;
		draftContent = note.content;
		openUuid = note.uuid;
		editing = false;
	}

	async function startEditing() {
		if (!open) return;
		draftTitle = open.title;
		draftContent = open.content;
		editing = true;

		await tick();
		titleInput?.focus();
	}

	// leaving edit mode is the save, the same way closing the note is
	function stopEditing() {
		commit();
		clearTimeout(idleTimer);
		editing = false;
	}

	function close() {
		commit();
		clearTimeout(idleTimer);
		openUuid = null;
		editing = false;
	}

	async function addNote() {
		if (!duck.uuid) return;
		await commit();

		try {
			const note = await createNote(duck.uuid);
			notes = [note, ...notes];
			draftTitle = '';
			draftContent = '';
			openUuid = note.uuid;
			editing = true; // a brand new note has nothing to read

			await tick();
			titleInput?.focus();
		} catch (err) {
			console.error('notes', err);
		}
	}

	// notes are meant to be near-permanent, and there is no undo and no history behind them,
	// so deletion asks first
	async function removeNote() {
		const note = open;
		confirmingDelete = false;
		if (!note) return;

		clearTimeout(idleTimer);
		try {
			await deleteNote(note.uuid);
			notes = notes.filter((n) => n.uuid !== note.uuid);
			openUuid = null;
			editing = false;
		} catch (err) {
			console.error('notes', err);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (confirmingDelete) return; // the dialog owns the keyboard while it is up

		if ((event.ctrlKey || event.metaKey) && event.key === 's') {
			event.preventDefault();
			commit();
		}
		// escape steps back one level: edit -> read -> list
		if (event.key === 'Escape') {
			if (editing) stopEditing();
			else close();
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
			<div class="d-flex gap-2 flex-shrink-0">
				{#if editing}
					<button class="notes-btn notes-btn-primary" type="button" on:click={stopEditing}>Done</button>
				{:else}
					<button class="notes-btn" type="button" on:click={startEditing}>Edit</button>
				{/if}
				<button class="notes-btn notes-btn-danger" type="button" on:click={() => (confirmingDelete = true)}>Delete</button>
			</div>
		{:else}
			<span class="notes-title fw-semibold">Notes</span>
			<button class="notes-btn" type="button" on:click={addNote} disabled={!duck.uuid}>New Note</button>
		{/if}
	</div>

	{#if open && editing}
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
				placeholder="Markdown. Fenced code blocks get highlighting and a copy button."
			></textarea>
		</div>
	{:else if open}
		<!-- svelte-ignore a11y-no-static-element-interactions -->
		<div class="note-reader flex-fill p-3" on:keydown={handleKeydown} tabindex="-1">
			<h2 class="note-read-title m-0">{displayTitle(open)}</h2>
			<div class="note-meta mb-3">
				created {formatDate(open.created)}{#if open.modified} · edited {formatDate(open.modified)}{/if}
			</div>
			{#if open.content.trim() === ''}
				<p class="notes-empty m-0">Empty. Hit Edit to write it.</p>
			{:else}
				<div class="note-markdown" use:enhanceMarkdown={rendered}>{@html rendered}</div>
			{/if}
		</div>
	{:else}
		<ul class="notes-list list-unstyled m-0 p-3">
			{#each ordered as note (note.uuid)}
				<li>
					<button class="note-item d-flex align-items-center gap-2 w-100" type="button" on:click={() => openNote(note)}>
						<span class="note-item-title flex-fill">{displayTitle(note)}</span>
						<span class="note-item-date">{formatDate(note.modified ?? note.created)}</span>
					</button>
				</li>
			{/each}

			{#if ordered.length === 0 && !loading}
				<li class="notes-empty">
					Nothing kept yet. Notes are the things you will want to look up again.
				</li>
			{/if}
		</ul>
	{/if}
</div>

{#if confirmingDelete && open}
	<ConfirmDialog
		title="Delete “{displayTitle(open)}”?"
		body="Notes are kept because you will want them again. This one goes for good — there is no undo."
		confirmLabel="Delete note"
		on:confirm={removeNote}
		on:cancel={() => (confirmingDelete = false)}
	/>
{/if}

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

	.notes-btn-primary {
		background: rgba(94, 106, 158, 0.9);
		border-color: rgba(94, 106, 158, 0.9);
		color: rgba(255, 255, 255, 0.96);
	}

	.notes-btn-primary:hover:not(:disabled) {
		background: rgba(78, 89, 138, 1);
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

	.notes-list {
		overflow-y: auto;
	}

	.note-item {
		text-align: left;
		color: inherit; /* a <button> does not inherit color, so dark mode left it near black */
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

	.note-reader {
		overflow-y: auto;
		min-height: 0;
	}

	.note-reader:focus {
		outline: none;
	}

	.note-read-title {
		font-size: 1.05rem;
		font-weight: 650;
	}

	/* a rendered document: comfortable to read, tight enough for a half-width panel */
	.note-markdown {
		font-size: 0.88rem;
		line-height: 1.6;
	}

	.note-markdown :global(h1),
	.note-markdown :global(h2),
	.note-markdown :global(h3) {
		font-size: 0.95rem;
		font-weight: 650;
		margin: 1rem 0 0.4rem;
	}

	.note-markdown :global(p),
	.note-markdown :global(ul),
	.note-markdown :global(ol) {
		margin: 0 0 0.7rem;
	}

	.note-markdown :global(ul),
	.note-markdown :global(ol) {
		padding-left: 1.2rem;
	}

	.note-markdown :global(li) {
		margin-bottom: 0.2rem;
	}

	.note-markdown :global(a) {
		word-break: break-word;
	}

	.note-markdown :global(blockquote) {
		margin: 0 0 0.7rem;
		padding-left: 0.7rem;
		border-left: 3px solid rgba(94, 106, 158, 0.4);
		color: rgba(90, 90, 105, 0.9);
	}

	.note-markdown :global(code) {
		font-family: 'GG Mono', 'Courier New', monospace;
		font-size: 0.82rem;
	}

	.note-markdown :global(pre) {
		position: relative;
		background: rgba(120, 120, 130, 0.09);
		border: 1px solid rgba(212, 212, 250, 0.45);
		border-radius: 6px;
		padding: 0.6rem 0.7rem;
		margin: 0 0 0.7rem;
		overflow-x: auto;
	}

	.note-markdown :global(pre code) {
		background: none;
		padding: 0;
		font-size: 0.8rem;
		line-height: 1.5;
	}

	/* always visible, not revealed on hover - it has to work on touch (T-12) */
	.note-markdown :global(.md-copy) {
		position: absolute;
		top: 0.3rem;
		right: 0.3rem;
		font-size: 0.68rem;
		font-weight: 600;
		padding: 0.1rem 0.45rem;
		border-radius: 4px;
		border: 1px solid rgba(120, 120, 140, 0.35);
		background: rgba(255, 255, 255, 0.85);
		color: rgba(70, 70, 90, 0.9);
		cursor: pointer;
	}

	.note-markdown :global(.md-copy:hover) {
		background: rgba(255, 255, 255, 1);
		border-color: rgba(94, 106, 158, 0.6);
	}

	.note-markdown :global(table) {
		border-collapse: collapse;
		margin-bottom: 0.7rem;
		font-size: 0.82rem;
	}

	.note-markdown :global(th),
	.note-markdown :global(td) {
		border: 1px solid rgba(212, 212, 250, 0.5);
		padding: 0.25rem 0.5rem;
	}

	.note-markdown :global(hr) {
		border: none;
		border-top: 1px solid rgba(212, 212, 250, 0.6);
		margin: 0.9rem 0;
	}

	.note-title-input {
		font-size: 1rem;
		font-weight: 600;
		border: none;
		color: inherit; /* same as .note-item - an <input> needs it spelled out */
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

	:global(:root[data-theme="dark"]) .note-item-date,
	:global(:root[data-theme="dark"]) .note-meta,
	:global(:root[data-theme="dark"]) .notes-empty {
		color: rgba(175, 180, 195, 0.8);
	}

	:global(:root[data-theme="dark"]) .note-markdown :global(pre) {
		background: rgba(25, 25, 24, 0.6);
		border-color: rgba(80, 80, 80, 0.5);
	}

	:global(:root[data-theme="dark"]) .note-markdown :global(.md-copy) {
		background: rgba(45, 45, 43, 0.95);
		border-color: rgba(120, 120, 130, 0.5);
		color: rgba(215, 215, 225, 0.9);
	}

	:global(:root[data-theme="dark"]) .note-markdown :global(blockquote) {
		color: rgba(196, 196, 205, 0.85);
	}

	:global(:root[data-theme="dark"]) .note-content-input {
		background: rgba(25, 25, 24, 0.6);
		border-color: rgba(80, 80, 80, 0.5);
		color: var(--text-primary);
	}
</style>
