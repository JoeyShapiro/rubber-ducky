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
	<div use:markdown class="toast fade show m-2 message-box position-relative {$hidden ? 'spoil' : ''}" role="alert" aria-live="assertive" aria-atomic="true">
		<div class="toast-body text-body mb-2" style="min-height: 4rem;">
			{#if message.from != 'user'}{message.from}: {/if}{@html message.content}
			{#if message.attachments.length > 0}
				<div class="attachments d-flex flex-column gap-2 mt-2">
					{#each message.attachments as attachment}
						{#if attachment.type.startsWith('image/')}
							<a href="/attachments?uuid={attachment.uuid}" target="_blank" rel="noreferrer" class="attachment-image-link">
								<img src="/attachments?uuid={attachment.uuid}" alt={attachment.name} class="attachment-image" loading="lazy" />
							</a>
						{:else}
							<a href="/attachments?uuid={attachment.uuid}" class="attachment-file acrylic d-flex align-items-center gap-2 p-2" download={attachment.name}>
								<img src="/cute-doc.svg" alt="" width="28" height="28" />
								<span class="attachment-file-name flex-fill">{attachment.name}</span>
								<svg class="attachment-file-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
									<path d="M8 1a.5.5 0 0 1 .5.5v6.793l2.146-2.147a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 0 1 .708-.708L7.5 8.293V1.5A.5.5 0 0 1 8 1z" />
									<path d="M2.5 13a.5.5 0 0 1 0-1h11a.5.5 0 0 1 0 1h-11z" />
								</svg>
							</a>
						{/if}
					{/each}
				</div>
			{/if}
		</div>
		<small class="text-muted position-absolute m-1 bottom-0 end-0">{formatDate(message.timestamp)}</small>
	</div>
{/if}

<style>
	/* bootstrap pins .toast to 350px; messages should use the width they are given */
	.message-box {
		width: auto;
		max-width: none;
	}

	.acrylic {
		background: rgba(212, 212, 250, 0.3);
		-webkit-backdrop-filter: blur(10px);
		backdrop-filter: blur(10px);
	}

	.attachments {
		max-width: 420px;
	}

	.attachment-image-link {
		display: block;
		width: fit-content;
		line-height: 0;
	}

	.attachment-image {
		max-width: 100%;
		max-height: 350px;
		border-radius: 8px;
		border: 1px solid rgba(212, 212, 250, 0.35);
	}

	.attachment-file {
		border-radius: 8px;
		border: 1px solid rgba(212, 212, 250, 0.45);
		text-decoration: none;
		color: inherit;
		transition: border-color 0.12s ease, background 0.12s ease;
	}

	.attachment-file:hover {
		border-color: rgba(255, 193, 7, 0.6);
	}

	.attachment-file-name {
		font-size: 0.85rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}

	.attachment-file-icon {
		width: 1rem;
		height: 1rem;
		flex-shrink: 0;
		opacity: 0.55;
	}

	:global(:root[data-theme="dark"]) .attachment-file {
		border-color: rgba(88, 88, 88, 0.55);
	}

	.system-log-entry {
		display: flex;
		align-items: baseline;
		gap: 0.45rem;
		width: auto;
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

	/* note and quest lifecycle, keyed off the trailing verb the same way statuses are */
	.system-log-created,
	.system-log-added {
		background: rgba(94, 106, 158, 0.08);
		border-color: rgba(120, 120, 130, 0.18);
		border-left-color: rgba(94, 106, 158, 0.6);
	}

	.system-log-modified {
		background: rgba(94, 106, 158, 0.05);
		border-color: rgba(120, 120, 130, 0.18);
		border-left-color: rgba(94, 106, 158, 0.35);
	}

	.system-log-removed {
		background: rgba(220, 53, 69, 0.06);
		border-color: rgba(120, 120, 130, 0.18);
		border-left-color: rgba(220, 53, 69, 0.4);
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

	:global(:root[data-theme="dark"]) .system-log-created,
	:global(:root[data-theme="dark"]) .system-log-added {
		background: rgba(140, 150, 195, 0.1);
		border-left-color: rgba(140, 150, 195, 0.65);
	}

	:global(:root[data-theme="dark"]) .system-log-modified {
		background: rgba(140, 150, 195, 0.06);
		border-left-color: rgba(140, 150, 195, 0.4);
	}

	:global(:root[data-theme="dark"]) .system-log-removed {
		background: rgba(220, 53, 69, 0.1);
		border-left-color: rgba(220, 53, 69, 0.45);
	}
</style>
