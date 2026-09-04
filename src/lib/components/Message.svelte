<script lang="ts">
	import type { Message } from '$lib/types';
	import { hidden } from '$lib/stores';
	import { markdown } from '$lib/markdown';
	import { formatDate } from '$lib/format';
	import { statusFromSystemMessage } from '$lib/quests';

	export let message: Message;
</script>

{#if message.from === 'system'}
	<div use:markdown class="system-log-entry system-log-{statusFromSystemMessage(message.content)} {$hidden ? 'spoil' : ''}" role="log">
		<span class="system-log-glyph">◈</span>
		<span class="system-log-content">{@html message.content}</span>
		<span class="system-log-time">{formatDate(message.timestamp)}</span>
	</div>
{:else}
	<div use:markdown class="toast fade show m-2 w-75 position-relative {$hidden ? 'spoil' : ''}" role="alert" aria-live="assertive" aria-atomic="true">
		<div class="toast-body text-body mb-2" style="min-height: 4rem;">
			{#if message.from != 'user'}{message.from}: {/if}{@html message.content}
			{#if message.attachments.length > 0}
				{#each message.attachments as attachment}
					{#if attachment.type.includes('image')}
						<!-- the id is how hydrateImages() in Chat.svelte finds this; T-04 removes both -->
						<img id={attachment.uuid} src={attachment.content} alt={attachment.name} style="max-width: 100%" />
					{:else}
						<div class="card acrylic m-1 flip-card-inner">
							<div class="card-body">
								<img src="/cute-doc.svg" alt="duck" class="me-2" width="32" height="32" />
								<a href="/attachments?uuid={attachment.uuid}">{attachment.name}</a>
							</div>
						</div>
					{/if}
				{/each}
			{/if}
		</div>
		<small class="text-muted position-absolute m-1 bottom-0 end-0">{formatDate(message.timestamp)}</small>
	</div>
{/if}

<style>
	.acrylic {
		background: rgba(212, 212, 250, 0.3);
		-webkit-backdrop-filter: blur(10px);
		backdrop-filter: blur(10px);
	}

	.system-log-entry {
		display: flex;
		align-items: baseline;
		gap: 0.45rem;
		width: 75%;
		margin: 0.5rem;
		padding: 0.5rem 0.75rem 1.6rem;
		border-radius: 6px;
		border: 1px solid rgba(130, 130, 140, 0.22);
		border-left-width: 3px;
		background: rgba(120, 120, 130, 0.08);
		font-size: 0.82rem;
		font-family: 'Courier New', monospace;
		letter-spacing: 0.01em;
		color: rgba(60, 60, 70, 0.72);
		position: relative;
	}

	.system-log-glyph {
		flex-shrink: 0;
		opacity: 0.55;
		font-size: 0.7rem;
	}

	.system-log-content {
		flex: 1;
		min-width: 0;
	}

	.system-log-time {
		position: absolute;
		bottom: 0.25rem;
		right: 0.5rem;
		font-size: 0.68rem;
		opacity: 0.5;
		white-space: nowrap;
	}

	.system-log-active {
		background: rgba(25, 135, 84, 0.07);
		border-color: rgba(120, 120, 130, 0.18);
		border-left-color: rgba(25, 135, 84, 0.5);
	}

	.system-log-inactive {
		background: rgba(108, 117, 125, 0.07);
		border-color: rgba(120, 120, 130, 0.18);
		border-left-color: rgba(108, 117, 125, 0.45);
	}

	.system-log-completed {
		background: rgba(13, 202, 240, 0.07);
		border-color: rgba(120, 120, 130, 0.18);
		border-left-color: rgba(13, 202, 240, 0.5);
	}

	.system-log-aborted {
		background: rgba(220, 53, 69, 0.07);
		border-color: rgba(120, 120, 130, 0.18);
		border-left-color: rgba(220, 53, 69, 0.45);
	}

	.system-log-locked {
		background: rgba(255, 193, 7, 0.07);
		border-color: rgba(120, 120, 130, 0.18);
		border-left-color: rgba(255, 193, 7, 0.5);
	}

	:global(:root[data-theme="dark"]) .system-log-entry {
		background: rgba(80, 80, 90, 0.15);
		border-color: rgba(160, 160, 170, 0.18);
		color: rgba(180, 180, 190, 0.7);
	}

	:global(:root[data-theme="dark"]) .system-log-active {
		background: rgba(32, 201, 151, 0.08);
		border-left-color: rgba(32, 201, 151, 0.5);
	}

	:global(:root[data-theme="dark"]) .system-log-inactive {
		background: rgba(173, 181, 189, 0.08);
		border-left-color: rgba(173, 181, 189, 0.4);
	}

	:global(:root[data-theme="dark"]) .system-log-completed {
		background: rgba(13, 202, 240, 0.08);
		border-left-color: rgba(13, 202, 240, 0.5);
	}

	:global(:root[data-theme="dark"]) .system-log-aborted {
		background: rgba(220, 53, 69, 0.1);
		border-left-color: rgba(220, 53, 69, 0.5);
	}

	:global(:root[data-theme="dark"]) .system-log-locked {
		background: rgba(255, 193, 7, 0.08);
		border-left-color: rgba(255, 193, 7, 0.5);
	}
</style>
