<script lang="ts">
	import { mobileView, type MobileView } from '$lib/stores';

	// which content screen this bar belongs to - the other two get a jump-to icon on the right
	export let current: Exclude<MobileView, 'sidebar'>;
	export let title = '';

	// flat navigation, not a stack: every content screen is a peer, reachable from every other
	// one, and back always retraces to the duck/badling list rather than the previous screen
	// (2026-09-14, see NOTES.md decisions log - this replaces the earlier chat-is-the-hub model)
	const SCREENS: { id: Exclude<MobileView, 'sidebar'>; label: string; icon: string }[] = [
		{ id: 'chat', label: 'Messages', icon: '/message-regular-full.svg' },
		{ id: 'notes', label: 'Notes', icon: '/pen-to-square-regular-full.svg' },
		{ id: 'quests', label: 'Quests', icon: '/list-check-solid-full.svg' },
	];

	$: others = SCREENS.filter((s) => s.id !== current);
</script>

<!--
	Hidden by default (app.css [data-screen] rules), shown only below the mobile breakpoint.
	Desktop never renders this visibly - it exists in the DOM but takes up no space there.
-->
<div class="mobile-topbar align-items-center">
	<button
		type="button"
		class="mobile-topbar-back"
		aria-label="Back to Ducks"
		on:click={() => mobileView.set('sidebar')}
	>
		<img src="/bars-solid-full.svg" alt="" width="18" height="18" />
	</button>
	{#if title}<span class="mobile-topbar-title">{title}</span>{/if}
	<div class="mobile-topbar-spacer"></div>
	{#each others as screen (screen.id)}
		<button
			type="button"
			class="mobile-topbar-action"
			aria-label={screen.label}
			on:click={() => mobileView.set(screen.id)}
		>
			<img src={screen.icon} alt="" width="18" height="18" />
		</button>
	{/each}
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

	.mobile-topbar-back,
	.mobile-topbar-action {
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

	.mobile-topbar-back img,
	.mobile-topbar-action img {
		width: 1.15rem;
		height: 1.15rem;
	}

	.mobile-topbar-back:active,
	.mobile-topbar-action:active {
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
</style>
