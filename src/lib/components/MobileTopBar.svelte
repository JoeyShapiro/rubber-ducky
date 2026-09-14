<script lang="ts">
	import { mobileView, type MobileView } from '$lib/stores';

	// where the back arrow goes: chat -> sidebar, notes/quests -> chat
	export let backTo: MobileView;
	export let title = '';
</script>

<!--
	Hidden by default (app.css [data-screen] rules), shown only below the mobile breakpoint.
	Desktop never renders this visibly - it exists in the DOM but takes up no space there.
-->
<div class="mobile-topbar align-items-center">
	<button
		type="button"
		class="mobile-topbar-back"
		aria-label="Back"
		on:click={() => mobileView.set(backTo)}
	>
		<svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
			<path d="M10 13 5 8l5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
		</svg>
	</button>
	{#if title}<span class="mobile-topbar-title">{title}</span>{/if}
	<div class="mobile-topbar-spacer"></div>
	<slot name="actions" />
</div>

<style>
	.mobile-topbar {
		display: none;
		flex-shrink: 0;
		gap: 0.4rem;
		padding: 0.5rem 0.6rem;
		border-bottom: 1px solid var(--item-hairline);
		background: var(--panel-surface);
		-webkit-backdrop-filter: blur(10px);
		backdrop-filter: blur(10px);
	}

	/* the app.css media query flips this to display:flex below the breakpoint - kept here rather
	   than solely in app.css so the component is legible on its own */
	@media (max-width: 768px) {
		.mobile-topbar {
			display: flex;
		}
	}

	.mobile-topbar-back {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.75rem;
		height: 2.75rem;
		flex-shrink: 0;
		padding: 0;
		border: none;
		border-radius: 6px;
		background: none;
		color: var(--text-primary);
		cursor: pointer;
	}

	.mobile-topbar-back svg {
		width: 1.1rem;
		height: 1.1rem;
	}

	.mobile-topbar-back:active {
		background: var(--row-hover);
	}

	.mobile-topbar-title {
		font-weight: 650;
		font-size: 1rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.mobile-topbar-spacer {
		flex: 1 1 auto;
	}

	.mobile-topbar :global(.mobile-topbar-action) {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 2.75rem;
		height: 2.75rem;
		flex-shrink: 0;
		padding: 0;
		border: none;
		border-radius: 6px;
		background: none;
		color: var(--text-primary);
		cursor: pointer;
	}

	.mobile-topbar :global(.mobile-topbar-action svg) {
		width: 1.15rem;
		height: 1.15rem;
	}

	.mobile-topbar :global(.mobile-topbar-action:active) {
		background: var(--row-hover);
	}
</style>
