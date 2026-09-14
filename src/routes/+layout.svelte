<script>
	import { onMount } from 'svelte';
	// bootstrap is a dependency now, not two cdn tags inside a component's <header>. the css goes
	// first so app.css keeps overriding it.
	import 'bootstrap/dist/css/bootstrap.min.css';
	import '../app.css';
	import Sidebar from './Sidebar.svelte';
	import { page } from '$app/stores';
	import { darkMode } from '$lib/stores';

	// Apply dark mode to the root element
	$: if (typeof document !== 'undefined') {
		if ($darkMode) {
			document.documentElement.setAttribute('data-theme', 'dark');
		} else {
			document.documentElement.removeAttribute('data-theme');
		}
	}

	// The only thing needing bootstrap's javascript is the sidebar's collapse. Loaded in the
	// browser because the bundle touches `document` at module scope; its data-api is a delegated
	// listener, so arriving after first paint is fine.
	// @ts-expect-error - bootstrap ships no type declarations (@types/bootstrap is a separate
	// package, and this is a side-effect import anyway: nothing from it is referenced)
	onMount(() => import('bootstrap/dist/js/bootstrap.esm.js'));
</script>

<div class="app d-flex flex-row">
	{#if $page.url.pathname !== '/login'}
		<Sidebar />
	{/if}

	<main class="d-flex flex-fill align-self-stretch">
		<slot />
	</main>
</div>

<style>
	.app {
		min-height: 100vh;
	}
</style>
