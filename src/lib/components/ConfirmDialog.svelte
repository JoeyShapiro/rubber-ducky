<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';

	export let title: string;
	export let body = '';
	export let confirmLabel = 'Delete';

	const dispatch = createEventDispatcher<{ confirm: void; cancel: void }>();

	// cancel takes focus, so a stray Enter or Space dismisses rather than destroys
	let cancelButton: HTMLButtonElement;
	onMount(() => cancelButton?.focus());

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') {
			event.stopPropagation();
			dispatch('cancel');
		}
	}
</script>

<div class="confirm-backdrop" on:click={(e) => e.target === e.currentTarget && dispatch('cancel')} role="presentation">
	<div class="confirm-card" role="alertdialog" aria-modal="true" aria-label={title}>
		<div class="confirm-body p-3">
			<p class="confirm-title m-0">{title}</p>
			{#if body}<p class="confirm-detail m-0 mt-2">{body}</p>{/if}
		</div>
		<div class="confirm-footer d-flex justify-content-end gap-2 px-3 pb-3">
			<!-- cancel sits where the button that opened this dialog was, so a double click
			     lands on the safe option rather than the destructive one -->
			<button bind:this={cancelButton} type="button" class="confirm-btn" on:click={() => dispatch('cancel')}>
				Cancel
			</button>
			<button type="button" class="confirm-btn confirm-btn-danger" on:click={() => dispatch('confirm')}>
				{confirmLabel}
			</button>
		</div>
	</div>
</div>

<svelte:window on:keydown={onKeydown} />

<style>
	.confirm-backdrop {
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

	.confirm-card {
		width: min(400px, 100%);
		background: rgba(248, 248, 255, 0.97);
		border: 1px solid rgba(212, 212, 250, 0.5);
		border-radius: 12px;
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
	}

	.confirm-title {
		font-size: 0.95rem;
		font-weight: 650;
		color: rgba(33, 33, 44, 0.92);
	}

	.confirm-detail {
		font-size: 0.82rem;
		color: rgba(90, 90, 105, 0.9);
	}

	.confirm-btn {
		font-size: 0.8rem;
		font-weight: 600;
		padding: 0.3rem 0.9rem;
		border-radius: 999px;
		border: 1px solid rgba(120, 120, 140, 0.4);
		background: rgba(255, 255, 255, 0.7);
		color: rgba(50, 50, 65, 0.95);
		cursor: pointer;
	}

	.confirm-btn:hover {
		background: rgba(255, 255, 255, 1);
	}

	.confirm-btn:focus-visible {
		outline: 2px solid rgba(94, 106, 158, 0.7);
		outline-offset: 1px;
	}

	.confirm-btn-danger {
		border-color: rgba(220, 53, 69, 0.5);
		background: rgba(220, 53, 69, 0.1);
		color: rgba(140, 30, 40, 0.95);
	}

	.confirm-btn-danger:hover {
		background: rgba(220, 53, 69, 0.2);
	}

	:global(:root[data-theme="dark"]) .confirm-card {
		background: rgba(35, 35, 33, 0.97);
		border-color: rgba(88, 88, 88, 0.45);
	}

	:global(:root[data-theme="dark"]) .confirm-title {
		color: rgba(234, 234, 234, 0.95);
	}

	:global(:root[data-theme="dark"]) .confirm-detail {
		color: rgba(196, 196, 205, 0.85);
	}

	:global(:root[data-theme="dark"]) .confirm-btn {
		background: rgba(45, 45, 43, 0.9);
		border-color: rgba(120, 120, 130, 0.45);
		color: rgba(225, 225, 230, 0.95);
	}

	:global(:root[data-theme="dark"]) .confirm-btn:hover {
		background: rgba(60, 60, 58, 1);
	}

	:global(:root[data-theme="dark"]) .confirm-btn-danger {
		background: rgba(220, 53, 69, 0.18);
		border-color: rgba(220, 53, 69, 0.5);
		color: rgba(255, 185, 191, 0.95);
	}

	:global(:root[data-theme="dark"]) .confirm-btn-danger:hover {
		background: rgba(220, 53, 69, 0.3);
	}
</style>
