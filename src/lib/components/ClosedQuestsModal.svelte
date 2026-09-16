<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Quest } from '$lib/types';
	import { iconForStatus, toStatusClass, toStatusLabel } from '$lib/quests';
	import { formatDate } from '$lib/format';
	import { enhanceMarkdown, renderMarkdown } from '$lib/markdown';

	// caller passes these pre-sorted (most recently closed first) and pre-filtered to whichever
	// level of the hierarchy is open - this component just renders and paginates
	export let quests: Quest[] = [];

	const dispatch = createEventDispatcher<{ close: void }>();

	const PAGE_SIZE = 20;
	let visibleCount = PAGE_SIZE;
	let expanded = new Set<string>();

	$: visibleQuests = quests.slice(0, visibleCount);

	function toggle(uuid: string) {
		if (expanded.has(uuid)) expanded.delete(uuid);
		else expanded.add(uuid);
		expanded = expanded; // Set mutation needs the reassignment to be reactive
	}

	// reveals more of the already-loaded list rather than fetching - there's nothing left to
	// fetch, the quests are already in memory
	function handleScroll(event: Event) {
		if (visibleCount >= quests.length) return;
		const el = event.currentTarget as HTMLDivElement;
		if (el.scrollHeight - el.scrollTop - el.clientHeight < 150) {
			visibleCount = Math.min(quests.length, visibleCount + PAGE_SIZE);
		}
	}
</script>

<div class="closed-modal-backdrop" on:click={(e) => e.target === e.currentTarget && dispatch('close')} role="presentation">
	<div class="closed-modal card" role="dialog" aria-modal="true" aria-label="Closed quests">
		<div class="closed-modal-header d-flex justify-content-between align-items-center px-3 py-2">
			<h2 class="closed-modal-title m-0">Closed quests</h2>
			<button type="button" class="closed-modal-close" on:click={() => dispatch('close')} aria-label="Close">&times;</button>
		</div>

		<div class="closed-modal-body" on:scroll={handleScroll}>
			{#if quests.length === 0}
				<p class="closed-modal-empty m-0">Nothing else closed here.</p>
			{:else}
				<ul class="closed-modal-list list-unstyled m-0">
					{#each visibleQuests as quest (quest.uuid)}
						<li class="closed-row">
							<button type="button" class="closed-row-main" on:click={() => toggle(quest.uuid)}>
								<span class="closed-icon {toStatusClass(quest.status)}">
									<svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
										<path d={iconForStatus(quest.status)}></path>
									</svg>
								</span>
								<span class="closed-row-text">
									<span class="closed-row-title">{quest.title}</span>
									<small class="closed-row-meta">
										{toStatusLabel(quest.status)}{#if quest.updated_on} &middot; {formatDate(quest.updated_on)}{/if}
									</small>
								</span>
							</button>

							{#if expanded.has(quest.uuid)}
								<div class="closed-row-detail">
									{#if quest.description.trim() !== ''}
										{@const html = renderMarkdown(quest.description)}
										<div class="markdown" use:enhanceMarkdown={html}>{@html html}</div>
									{:else}
										<p class="closed-modal-empty m-0">No description.</p>
									{/if}
								</div>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
</div>

<svelte:window on:keydown={(e) => e.key === 'Escape' && dispatch('close')} />

<style>
	.closed-modal-backdrop {
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

	.closed-modal {
		width: min(480px, 100%);
		max-height: min(640px, 90vh);
		display: flex;
		flex-direction: column;
		background: rgba(248, 248, 255, 0.96);
		border: 1px solid rgba(212, 212, 250, 0.5);
		border-radius: 12px;
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
	}

	.closed-modal-header {
		background: rgba(212, 212, 250, 0.45);
		border-bottom: 1px solid rgba(212, 212, 250, 0.5);
		border-radius: 12px 12px 0 0;
		flex-shrink: 0;
	}

	.closed-modal-title {
		font-size: 1rem;
		font-weight: 650;
		color: rgba(33, 33, 44, 0.9);
	}

	.closed-modal-close {
		border: none;
		background: transparent;
		font-size: 1.3rem;
		line-height: 1;
		color: rgba(33, 33, 44, 0.6);
		cursor: pointer;
		padding: 0.1rem 0.4rem;
	}

	.closed-modal-close:hover {
		color: rgba(33, 33, 44, 0.95);
	}

	.closed-modal-body {
		overflow-y: auto;
		padding: 0.4rem 0.5rem;
	}

	.closed-modal-empty {
		font-size: 0.9rem;
		font-style: italic;
		color: rgba(108, 117, 125, 0.85);
		padding: 0.75rem 0.5rem;
	}

	.closed-row {
		border-bottom: 1px solid rgba(212, 212, 250, 0.35);
	}

	.closed-row:last-child {
		border-bottom: none;
	}

	.closed-row-main {
		width: 100%;
		display: flex;
		align-items: center;
		gap: 0.6rem;
		padding: 0.5rem 0.3rem;
		border: none;
		background: transparent;
		text-align: left;
		cursor: pointer;
	}

	.closed-icon {
		width: 1.7rem;
		height: 1.7rem;
		flex-shrink: 0;
		border-radius: 999px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1px solid transparent;
	}

	.closed-icon svg {
		width: 0.9rem;
		height: 0.9rem;
	}

	.closed-row-text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.closed-row-title {
		font-size: 0.95rem;
		font-weight: 600;
		color: rgba(33, 33, 44, 0.92);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.closed-row-meta {
		font-size: 0.75rem;
		color: rgba(108, 117, 125, 0.9);
	}

	.closed-row-detail {
		font-size: 0.85rem;
		padding: 0 0.3rem 0.6rem 2.6rem;
	}

	.closed-icon.task-status-completed {
		background: rgba(13, 202, 240, 0.12);
		color: rgba(5, 110, 140, 0.95);
		border-color: rgba(13, 202, 240, 0.3);
	}

	.closed-icon.task-status-aborted {
		background: rgba(220, 53, 69, 0.12);
		color: rgba(132, 32, 41, 0.95);
		border-color: rgba(220, 53, 69, 0.3);
	}

	:global(:root[data-theme="dark"]) .closed-modal {
		background: rgba(35, 35, 33, 0.97);
		border-color: rgba(88, 88, 88, 0.45);
	}

	:global(:root[data-theme="dark"]) .closed-modal-header {
		background: rgba(55, 55, 52, 0.8);
		border-bottom-color: rgba(88, 88, 88, 0.5);
	}

	:global(:root[data-theme="dark"]) .closed-modal-title {
		color: rgba(234, 234, 234, 0.95);
	}

	:global(:root[data-theme="dark"]) .closed-modal-close {
		color: rgba(234, 234, 234, 0.7);
	}

	:global(:root[data-theme="dark"]) .closed-modal-close:hover {
		color: rgba(234, 234, 234, 0.98);
	}

	:global(:root[data-theme="dark"]) .closed-row {
		border-bottom-color: rgba(88, 88, 88, 0.35);
	}

	:global(:root[data-theme="dark"]) .closed-row-title {
		color: rgba(234, 234, 234, 0.95);
	}

	:global(:root[data-theme="dark"]) .closed-icon.task-status-completed {
		background: rgba(13, 202, 240, 0.2);
		color: rgba(156, 236, 255, 0.95);
		border-color: rgba(13, 202, 240, 0.35);
	}

	:global(:root[data-theme="dark"]) .closed-icon.task-status-aborted {
		background: rgba(220, 53, 69, 0.22);
		color: rgba(255, 185, 191, 0.95);
		border-color: rgba(220, 53, 69, 0.35);
	}
</style>
