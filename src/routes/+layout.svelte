<script>
	// Bootstrap's CSS only - its JavaScript is not loaded at all. The sidebar collapse was the
	// one thing using it, and that is local state now. Imported before app.css so overrides win.
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
