<script lang="ts">
	import { onMount } from 'svelte';
	import { Attachment, type Duck } from '$lib/types';
	import { messages } from '$lib/stores';
	import { askQuestion, sendMessage, uploadAttachment } from '$lib/api';

	export let duck: Duck;

	let text = '';
	let attachments: Attachment[] = [];
	let question = false;
	let textarea: HTMLTextAreaElement;
	let fileInput: HTMLInputElement;

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

	async function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (!input?.files) {
			return;
		}

		await addFiles(Array.from(input.files));
		input.value = ''; // so the same file can be picked twice in a row
	}

	function resize() {
		if (!textarea) return;
		textarea.style.height = 'auto';
		textarea.style.height = textarea.scrollHeight + 'px';
	}

	async function handleSubmit() {
		if (text === '' || duck.name === '') {
			return;
		}

		const body = text;

		if (question) {
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
					// only images are rendered inline, so the rest can drop their base64
					if (!attachment.type.includes('image')) {
						attachment.content = '';
					}

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
	}

	function handleKeydown(event: KeyboardEvent) {
		// submit on enter, shift+enter for newline
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			handleSubmit();
		}
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
	id="load-btn"
>
	<img src="/magic.svg" alt="magic" class="me-2" width="32" height="32" />
</button>

<form class="input-group mb-2 w-100 p-1" on:submit|preventDefault={handleSubmit} id="form">
	<button type="button" class="btn btn-outline-secondary position-relative" on:click={() => fileInput?.click()}>
		<img src="/attachment.svg" alt="attachment" class="me-2" width="16" height="16" />
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
		placeholder="Message"
		id="send-text"
	></textarea>
	<input bind:this={fileInput} type="file" accept="*" on:change={handleFileSelect} style="display: none;" />
	<div id="send-btn-listener">
		<input
			style="width: auto; height: 100%; {question ? 'background-color: #ba34eb !important;' : ''}"
			class="btn btn-warning"
			type="submit"
			id="send-btn"
			value="Send"
		/>
	</div>
</form>

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
</style>
