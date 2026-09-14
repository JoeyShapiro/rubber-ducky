<script lang="ts">
	import { mobileView, type MobileView } from '$lib/stores';
	import { Badling, type Scope } from '$lib/types';

	// which content screen this bar belongs to - the other two get a jump-to icon on the right
	export let current: Exclude<MobileView, 'sidebar'>;
	export let scope: Scope;

	// flat navigation, not a stack: every content screen is a peer, reachable from every other
	// one, and back always retraces to the duck/badling list rather than the previous screen
	// (2026-09-14, see NOTES.md decisions log - this replaces the earlier chat-is-the-hub model)
	const SCREENS: { id: Exclude<MobileView, 'sidebar'>; label: string; icon: string }[] = [
		{ id: 'chat', label: 'Messages', icon: '/message-regular-full.svg' },
		{ id: 'notes', label: 'Notes', icon: '/pen-to-square-regular-full.svg' },
		{ id: 'quests', label: 'Quests', icon: '/list-check-solid-full.svg' },
	];

	$: others = SCREENS.filter((s) => s.id !== current);
	$: currentLabel = SCREENS.find((s) => s.id === current)?.label ?? '';

	// "badling / duck / screen" for a duck, "badling / screen" for a badling itself - a plain
	// duck has no badling name to show (shouldn't happen once loaded through the sidebar, but
	// nothing here assumes it).
	$: crumbs = (scope instanceof Badling ? [scope.name] : [scope.badlingName, scope.name].filter(Boolean)).concat(currentLabel);
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
	<span class="mobile-topbar-title">
		{#each crumbs as crumb, i}
			{#if i > 0}<span class="mobile-topbar-crumb-sep">/</span>{/if}
			<span class="mobile-topbar-crumb" class:current={i === crumbs.length - 1}>{crumb}</span>
		{/each}
	</span>
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
		/* explicit, not inherited - a container this sits in (Quests' Futura Condensed, e.g.)
		   must never change what the bar itself looks like. Same reasoning as font-size below. */
		font-family: "GG Sans", Verdana, Tahoma;
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

	/* a single inline-flowing line rather than flex, so overflow can ellipsis the whole path at
	   once instead of needing per-crumb truncation logic */
	.mobile-topbar-title {
		min-width: 0;
		flex-shrink: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 1rem;
	}

	/* ancestors (badling, duck) read as a path leading up to where you are; only the current
	   screen is full weight - same idea as .breadcrumb-current in Quests.svelte's own trail */
	.mobile-topbar-crumb {
		font-size: 0.85em;
		font-weight: 500;
		opacity: 0.6;
	}

	.mobile-topbar-crumb.current {
		font-size: 1em;
		font-weight: 650;
		opacity: 1;
	}

	.mobile-topbar-crumb-sep {
		margin: 0 0.15rem;
		opacity: 0.35;
	}

	.mobile-topbar-spacer {
		flex: 1 1 auto;
	}
</style>
