<script lang="ts">
	import { createEventDispatcher } from 'svelte';

	export let parentTitle = '';

	const dispatch = createEventDispatcher<{
		accept: { title: string; description: string; due: string };
		decline: void;
	}>();

	let title = '';
	let description = '';
	let due = '';

	function accept() {
		if (title.trim() === '') return;
		dispatch('accept', { title: title.trim(), description: description.trim(), due });
	}
</script>

<div class="task-modal-backdrop" on:click={(e) => e.target === e.currentTarget && dispatch('decline')} role="presentation">
	<div class="task-modal card" role="dialog" aria-modal="true" aria-label="Create task">
		<div class="task-modal-header d-flex justify-content-between align-items-center px-3 py-2">
			<h2 class="task-modal-title m-0">{parentTitle ? `New Subquest of "${parentTitle}"` : 'Create New Quest'}</h2>
		</div>
		<div class="task-modal-body p-3">
			<label class="form-label mb-1" for="task-title">Title</label>
			<!-- svelte-ignore a11y-autofocus -->
			<input id="task-title" class="form-control mb-3" bind:value={title} placeholder="Quest title" maxlength="120" autofocus />

			<label class="form-label mb-1" for="task-description">Description</label>
			<textarea id="task-description" class="form-control mb-3" bind:value={description} placeholder="Describe the quest..." rows="4"></textarea>

			<label class="form-label mb-1" for="task-due">Due Date <span class="text-muted fw-normal">(optional)</span></label>
			<input id="task-due" class="form-control" type="date" bind:value={due} />
		</div>
		<div class="task-modal-footer d-flex justify-content-end gap-2 px-3 pb-3">
			<button type="button" class="btn btn-outline-secondary" on:click={() => dispatch('decline')}>Decline</button>
			<button type="button" class="btn btn-warning" on:click={accept} disabled={title.trim() === ''}>Accept</button>
		</div>
	</div>
</div>

<svelte:window on:keydown={(e) => e.key === 'Escape' && dispatch('decline')} />

<style>
	.task-modal-backdrop {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		background: rgba(18, 18, 28, 0.42);
		backdrop-filter: blur(3px);
		-webkit-backdrop-filter: blur(3px);
		z-index: 1100;
	}

	.task-modal {
		width: min(560px, 100%);
		background: rgba(248, 248, 255, 0.96);
		border: 1px solid rgba(212, 212, 250, 0.5);
		border-radius: 12px;
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
	}

	.task-modal-header {
		background: rgba(212, 212, 250, 0.45);
		border-bottom: 1px solid rgba(212, 212, 250, 0.5);
	}

	.task-modal-title {
		font-size: 1rem;
		font-weight: 650;
		color: rgba(33, 33, 44, 0.9);
	}

	:global(:root[data-theme="dark"]) .task-modal {
		background: rgba(35, 35, 33, 0.97);
		border-color: rgba(88, 88, 88, 0.45);
	}

	:global(:root[data-theme="dark"]) .task-modal-header {
		background: rgba(55, 55, 52, 0.8);
		border-bottom-color: rgba(88, 88, 88, 0.5);
	}

	:global(:root[data-theme="dark"]) .task-modal-title {
		color: rgba(234, 234, 234, 0.95);
	}
</style>
