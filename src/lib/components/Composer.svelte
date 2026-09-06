<script lang="ts">
	import { onMount } from 'svelte';
	import { Attachment, type Duck } from '$lib/types';
	import { messages } from '$lib/stores';
	import { askQuestion, sendMessage, uploadAttachment } from '$lib/api';

	export let duck: Duck;

	let text = '';
	let attachments: Attachment[] = [];
	let question = false;
	let sending = false;
	let dragDepth = 0;
	let textarea: HTMLTextAreaElement;
	let fileInput: HTMLInputElement;

	$: dragging = dragDepth > 0;
	$: canSend = !sending && duck.uuid !== '' && (text.trim() !== '' || attachments.length > 0);

	// every attachment, however it got here, goes through this
	async function addFiles(files: File[]) {
		for (const file of files) {
			try {
				attachments = [...attachments, await Attachment.fromFile(file)];
			} catch (err) {
				console.error('attachment', err);
			}
		}
	}

	function removeAttachment(target: Attachment) {
		attachments = attachments.filter((a) => a !== target);
	}

	async function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input?.files) {
			return;
		}

		await addFiles(Array.from(input.files));
		input.value = ''; // so the same file can be picked twice in a row
	}

	// the base64 payload is 4 characters per 3 bytes
	function sizeOf(attachment: Attachment): string {
		const base64 = attachment.content.split(',')[1] ?? '';
		const bytes = Math.floor((base64.length * 3) / 4);

		if (bytes < 1024) return `${bytes} B`;
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
	}

	function resize() {
		if (!textarea) return;
		textarea.style.height = 'auto';
		textarea.style.height = textarea.scrollHeight + 'px';
	}

	async function handleSubmit() {
		if (!canSend) {
			return;
		}

		const body = text.trim();
		sending = true;

		// a bare attachment is a perfectly good message, but there is nothing to ask about
		if (question && body !== '') {
			question = false;
			askQuestion(duck.uuid, body)
				.then((data) => messages.update((list) => [...list, data.message]))
				.catch((err) => console.error('qna', err));
		}

		let created;
		try {
			created = (await sendMessage(duck.uuid, body)).message;
		} catch (err) {
			console.error('message', err);
			sending = false;
			return;
		}

		messages.update((list) => [...list, created]);
		text = '';
		resize();

		await Promise.all(
			attachments.map(async (attachment) => {
				try {
					const data = await uploadAttachment(created.uuid, attachment);
					attachment.uuid = data.attachment.uuid;
					// messages render attachments straight from /attachments?uuid=, so the base64
					// has done its job and can go
					attachment.content = '';

					messages.update((list) =>
						list.map((m) => {
							if (m.uuid === data.message) m.attachments.push(attachment);
							return m;
						}),
					);
				} catch (err) {
					console.error('attachment', err);
				}
			}),
		);

		attachments = [];
		sending = false;
	}

	function handleKeydown(event: KeyboardEvent) {
		// submit on enter, shift+enter for newline
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSubmit();
		}
	}

	function hasFiles(event: DragEvent): boolean {
		return Array.from(event.dataTransfer?.types ?? []).includes('Files');
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		dragDepth = 0;
		addFiles(Array.from(event.dataTransfer?.files ?? []));
	}

	onMount(() => {
		resize();

		function handlePaste(event: ClipboardEvent) {
			const files = Array.from(event.clipboardData?.items ?? [])
				.filter((item) => item.kind === 'file')
				.map((item) => item.getAsFile())
				.filter((file): file is File => file !== null);

			if (files.length === 0) {
				return;
			}

			event.preventDefault(); // don't drop the image into the textarea as well
			addFiles(files);
		}

		document.addEventListener('paste', handlePaste);
		return () => document.removeEventListener('paste', handlePaste);
	});
</script>

<button
	on:click={() => (question = !question)}
	class="btn btn-toggle rounded border-0 position-absolute"
	style="bottom: 4.5em; right: 1em;"
	type="button"
>
	<img src="/magic.svg" alt="magic" class="me-2" width="32" height="32" />
</button>

<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
	class="composer position-relative p-1"
	class:dragging
	on:dragenter={(e) => hasFiles(e) && dragDepth++}
	on:dragover|preventDefault
	on:dragleave={() => (dragDepth = Math.max(0, dragDepth - 1))}
	on:drop={handleDrop}
>
	{#if attachments.length > 0}
		<div class="attachment-tray d-flex gap-2 p-2 mb-1">
			{#each attachments as attachment (attachment)}
				<div class="attachment-card">
					{#if attachment.type.startsWith('image/')}
						<img class="attachment-preview" src={attachment.content} alt={attachment.name} />
					{:else}
						<div class="attachment-preview attachment-preview-generic">
							<img src="/cute-doc.svg" alt="" width="40" height="40" />
						</div>
					{/if}

					<div class="attachment-info">
						<span class="attachment-name" title={attachment.name}>{attachment.name}</span>
						<span class="attachment-size">{sizeOf(attachment)}</span>
					</div>

					<button
						type="button"
						class="attachment-remove"
						title="Remove {attachment.name}"
						aria-label="Remove {attachment.name}"
						on:click={() => removeAttachment(attachment)}
					>
						<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
							<path d="M6.5 1a.5.5 0 0 0-.5.5V2H3.5a.5.5 0 0 0 0 1H4v9.5A1.5 1.5 0 0 0 5.5 14h5a1.5 1.5 0 0 0 1.5-1.5V3h.5a.5.5 0 0 0 0-1H10v-.5a.5.5 0 0 0-.5-.5h-3zM5 3h6v9.5a.5.5 0 0 1-.5.5h-5a.5.5 0 0 1-.5-.5V3zm1.5 1.5a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5zm3 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V5a.5.5 0 0 1 .5-.5z" />
						</svg>
					</button>
				</div>
			{/each}
		</div>
	{/if}

	<form class="input-group mb-2 w-100" on:submit|preventDefault={handleSubmit}>
		<button
			type="button"
			class="btn btn-outline-secondary position-relative"
			title="Attach a file"
			aria-label="Attach a file"
			on:click={() => fileInput?.click()}
		>
			<img src="/attachment.svg" alt="" class="me-2" width="16" height="16" />
			{#if attachments.length > 0}
				<span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
					{attachments.length}
				</span>
			{/if}
		</button>
		<textarea
			bind:this={textarea}
			bind:value={text}
			on:input={resize}
			on:keydown={handleKeydown}
			style="width: auto;"
			class="form-control auto-resize"
			placeholder={attachments.length > 0 ? 'Add a comment (optional)' : 'Message'}
		></textarea>
		<input bind:this={fileInput} type="file" accept="*" multiple on:change={handleFileSelect} style="display: none;" />
		<div>
			<input
				style="width: auto; height: 100%; {question ? 'background-color: #ba34eb !important;' : ''}"
				class="btn btn-warning"
				type="submit"
				value="Send"
				disabled={!canSend}
			/>
		</div>
	</form>

	{#if dragging}
		<div class="drop-overlay">Drop files to attach</div>
	{/if}
</div>

<style>
	.auto-resize {
		resize: none;
		max-height: 33vh;
	}

	.btn-toggle {
		padding: .25rem .5rem;
		font-weight: 600;
		color: var(--bs-emphasis-color);
		background-color: transparent;
		width: 48px !important;
		height: 48px !important;
	}

	.btn-toggle:hover,
	.btn-toggle:focus {
		color: rgba(var(--bs-emphasis-color-rgb), .85);
		background-color: var(--bs-secondary-bg);
	}

	.attachment-tray {
		overflow-x: auto;
		background: rgba(248, 248, 255, 0.5);
		border: 1px solid rgba(212, 212, 250, 0.4);
		border-radius: 8px;
	}

	.attachment-card {
		position: relative;
		flex: 0 0 auto;
		width: 180px;
		padding: 0.5rem;
		border-radius: 8px;
		background: rgba(255, 255, 255, 0.65);
		border: 1px solid rgba(212, 212, 250, 0.5);
	}

	.attachment-preview {
		display: block;
		width: 100%;
		height: 110px;
		object-fit: contain;
		border-radius: 4px;
		background: rgba(120, 120, 130, 0.08);
	}

	.attachment-preview-generic {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.attachment-info {
		display: flex;
		flex-direction: column;
		margin-top: 0.4rem;
		min-width: 0;
	}

	.attachment-name {
		font-size: 0.8rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.attachment-size {
		font-size: 0.7rem;
		opacity: 0.6;
	}

	/* deliberately not hover-only: it has to be reachable by touch (T-12) */
	.attachment-remove {
		position: absolute;
		top: 0.25rem;
		right: 0.25rem;
		width: 1.75rem;
		height: 1.75rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1px solid rgba(212, 212, 250, 0.5);
		border-radius: 6px;
		background: rgba(255, 255, 255, 0.9);
		color: rgba(120, 120, 130, 0.9);
		cursor: pointer;
		transition: color 0.12s ease, border-color 0.12s ease;
	}

	.attachment-remove:hover,
	.attachment-remove:focus-visible {
		color: rgba(220, 53, 69, 0.95);
		border-color: rgba(220, 53, 69, 0.5);
	}

	.attachment-remove svg {
		width: 0.9rem;
		height: 0.9rem;
	}

	.composer.dragging {
		outline: 2px dashed rgba(255, 193, 7, 0.8);
		outline-offset: -4px;
		border-radius: 8px;
	}

	.drop-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 8px;
		background: rgba(255, 193, 7, 0.12);
		font-weight: 600;
		font-size: 0.9rem;
		pointer-events: none;
	}

	:global(:root[data-theme="dark"]) .attachment-tray {
		background: rgba(35, 35, 33, 0.6);
		border-color: rgba(88, 88, 88, 0.5);
	}

	:global(:root[data-theme="dark"]) .attachment-card {
		background: rgba(45, 45, 43, 0.8);
		border-color: rgba(88, 88, 88, 0.5);
	}

	:global(:root[data-theme="dark"]) .attachment-remove {
		background: rgba(25, 25, 24, 0.9);
		border-color: rgba(88, 88, 88, 0.6);
		color: rgba(200, 200, 205, 0.9);
	}
</style>
