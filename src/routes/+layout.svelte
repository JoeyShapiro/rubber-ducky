<script>
	import Header from './Header.svelte';
	import '../app.css';
	import Sidebar from './Sidebar.svelte';
	import { page } from '$app/stores';
	import { darkMode } from './stores.js';

	// Apply dark mode to the root element
	$: if (typeof document !== 'undefined') {
		if ($darkMode) {
			document.documentElement.setAttribute('data-theme', 'dark');
		} else {
			document.documentElement.removeAttribute('data-theme');
		}
	}
</script>

<div class="app d-flex flex-row">
	<Header />
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
