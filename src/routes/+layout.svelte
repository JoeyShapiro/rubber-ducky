<script>
	// Bootstrap's CSS only - its JavaScript is not loaded at all. The sidebar collapse was the
	// one thing using it, and that is local state now. Imported before app.css so overrides win.
	import 'bootstrap/dist/css/bootstrap.min.css';
	import '../app.css';
	import Sidebar from './Sidebar.svelte';
	import { page } from '$app/stores';
	import { darkMode, mobileView } from '$lib/stores';

	// Apply dark mode to the root element
	$: if (typeof document !== 'undefined') {
		if ($darkMode) {
			document.documentElement.setAttribute('data-theme', 'dark');
		} else {
			document.documentElement.removeAttribute('data-theme');
		}
	}

	// the mobile drawer CSS (app.css's [data-mobile-view] rules) hides <main> whenever
	// mobileView defaults to 'sidebar', on the assumption that <Sidebar> is showing instead -
	// true everywhere except /login, which renders no Sidebar and would otherwise go blank
	// (the login form lives in <main>). Omitting the attribute there turns the whole mechanism
	// off rather than special-casing every rule that reads it.
	$: isLogin = $page.url.pathname === '/login';
</script>

<div class="app d-flex flex-row" data-mobile-view={isLogin ? undefined : $mobileView}>
	{#if !isLogin}
		<Sidebar />
	{/if}

	<main class="d-flex flex-fill align-self-stretch">
		<slot />
	</main>
</div>

<style>
	.app {
		min-height: 100dvh;
	}
</style>
