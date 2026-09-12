<script lang="ts">
	import { onMount, tick } from 'svelte';
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
		// svelte applies the clear on the next tick, so measuring before it means measuring the
		// message you just sent - which is why the box never shrank back
		await tick();
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

	<form class="composer-form d-flex align-items-stretch gap-2 mb-2 w-100" on:submit|preventDefault={handleSubmit}>
		<div class="composer-side d-flex flex-column justify-content-between">
			<!-- placeholder: does nothing until message search exists (T-26) -->
			<button type="button" class="composer-icon" title="Search messages" aria-label="Search messages">
				<svg viewBox="0 0 640 640" fill="currentColor" aria-hidden="true">
					<path d="M480 272C480 317.9 465.1 360.3 440 394.7L566.6 521.4C579.1 533.9 579.1 554.2 566.6 566.7C554.1 579.2 533.8 579.2 521.3 566.7L394.7 440C360.3 465.1 317.9 480 272 480C157.1 480 64 386.9 64 272C64 157.1 157.1 64 272 64C386.9 64 480 157.1 480 272zM272 416C351.5 416 416 351.5 416 272C416 192.5 351.5 128 272 128C192.5 128 128 192.5 128 272C128 351.5 192.5 416 272 416z" />
				</svg>
			</button>
			<button
				type="button"
				class="composer-icon composer-magic"
				class:active={question}
				title={question ? 'Asking the duck' : 'Ask the duck'}
				aria-pressed={question}
				on:click={() => (question = !question)}
			>
				<!-- inlined: app.css inverts every svg file in dark mode, and this one is meant to
				     stay purple in both themes -->
				<svg viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
					<path d="M208,512a24.84,24.84,0,0,1-23.34-16l-39.84-103.6a16.06,16.06,0,0,0-9.19-9.19L32,343.34a25,25,0,0,1,0-46.68l103.6-39.84a16.06,16.06,0,0,0,9.19-9.19L184.66,144a25,25,0,0,1,46.68,0l39.84,103.6a16.06,16.06,0,0,0,9.19,9.19l103,39.63A25.49,25.49,0,0,1,400,320.52a24.82,24.82,0,0,1-16,22.82l-103.6,39.84a16.06,16.06,0,0,0-9.19,9.19L231.34,496A24.84,24.84,0,0,1,208,512Zm66.85-254.84h0Z" />
					<path d="M88,176a14.67,14.67,0,0,1-13.69-9.4L57.45,122.76a7.28,7.28,0,0,0-4.21-4.21L9.4,101.69a14.67,14.67,0,0,1,0-27.38L53.24,57.45a7.31,7.31,0,0,0,4.21-4.21L74.16,9.79A15,15,0,0,1,86.23.11,14.67,14.67,0,0,1,101.69,9.4l16.86,43.84a7.31,7.31,0,0,0,4.21,4.21L166.6,74.31a14.67,14.67,0,0,1,0,27.38l-43.84,16.86a7.28,7.28,0,0,0-4.21,4.21L101.69,166.6A14.67,14.67,0,0,1,88,176Z" />
					<path d="M400,256a16,16,0,0,1-14.93-10.26l-22.84-59.37a8,8,0,0,0-4.6-4.6l-59.37-22.84a16,16,0,0,1,0-29.86l59.37-22.84a8,8,0,0,0,4.6-4.6L384.9,42.68a16.45,16.45,0,0,1,13.17-10.57,16,16,0,0,1,16.86,10.15l22.84,59.37a8,8,0,0,0,4.6,4.6l59.37,22.84a16,16,0,0,1,0,29.86l-59.37,22.84a8,8,0,0,0-4.6,4.6l-22.84,59.37A16,16,0,0,1,400,256Z" />
				</svg>
			</button>
		</div>

		<textarea
			bind:this={textarea}
			bind:value={text}
			on:input={resize}
			on:keydown={handleKeydown}
			class="form-control auto-resize flex-fill"
			placeholder={attachments.length > 0 ? 'Add a comment (optional)' : 'Message'}
		></textarea>
		<input bind:this={fileInput} type="file" accept="*" multiple on:change={handleFileSelect} style="display: none;" />

		<div class="composer-side d-flex flex-column justify-content-between">
			<button
				type="submit"
				class="composer-icon composer-send"
				class:asking={question}
				title={question ? 'Ask' : 'Send'}
				aria-label={question ? 'Ask' : 'Send'}
				disabled={!canSend}
			>
				<svg viewBox="0 0 640 640" fill="currentColor" aria-hidden="true">
					<path d="M568.4 37.7C578.2 34.2 589 36.7 596.4 44C603.8 51.3 606.2 62.2 602.7 72L424.7 568.9C419.7 582.8 406.6 592 391.9 592C377.7 592 364.9 583.4 359.6 570.3L295.4 412.3C290.9 401.3 292.9 388.7 300.6 379.7L395.1 267.3C400.2 261.2 399.8 252.3 394.2 246.7C388.6 241.1 379.6 240.7 373.6 245.8L261.2 340.1C252.1 347.7 239.6 349.7 228.6 345.3L70.1 280.8C57 275.5 48.4 262.7 48.4 248.5C48.4 233.8 57.6 220.7 71.5 215.7L568.4 37.7z" />
				</svg>
			</button>
			<button
				type="button"
				class="composer-icon position-relative"
				title="Attach a file"
				aria-label="Attach a file"
				on:click={() => fileInput?.click()}
			>
				<img src="/attachment.svg" alt="" width="18" height="18" />
				{#if attachments.length > 0}
					<span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
						{attachments.length}
					</span>
				{/if}
			</button>
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
		/* two icon rows tall, so the cluster either side has something to sit against.
		   min-height clamps the inline height autoResize sets, so it still grows past this. */
		min-height: 4.1rem;
	}

	.composer-side {
		flex-shrink: 0;
		gap: 0.3rem;
	}

	/* align-items:end keeps the buttons pinned to the last line as the textarea grows,
	   instead of stretching to match it */
	.composer-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
		width: 1.9rem;
		height: 1.9rem;
		padding: 0;
		border: none;
		border-radius: 8px;
		background: none;
		color: rgba(108, 117, 125, 0.9);
		cursor: pointer;
		transition: background 0.12s ease, color 0.12s ease, transform 0.12s ease;
	}

	.composer-icon:hover:not(:disabled) {
		background: rgba(120, 120, 140, 0.12);
	}

	.composer-icon:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.composer-send {
		color: #ffc107;
	}

	/* purple in both themes - it is inlined precisely so the dark-mode svg invert cannot reach it */
	.composer-magic {
		color: #ba34eb;
	}

	.composer-magic svg {
		width: 1rem;
		height: 1rem;
	}

	/* the icon is always purple, so the on state needs its own signal */
	.composer-magic.active {
		background: rgba(186, 52, 235, 0.18);
	}

	.composer-magic.active:hover {
		background: rgba(186, 52, 235, 0.28);
	}

	.composer-send svg,
	.composer-icon svg {
		width: 1.05rem;
		height: 1.05rem;
		transition: transform 0.12s ease;
	}

	.composer-send:hover:not(:disabled) svg {
		transform: translateX(1px) translateY(-1px);
	}

	/* the question toggle used to colour the send button's background; with the background gone
	   the plane itself carries it */
	.composer-send.asking {
		color: #ba34eb;
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
