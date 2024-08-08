<script>
	import Header from './Header.svelte';
	import '../app.css';
	import Sidebar from './Sidebar.svelte';
</script>

<div class="app d-flex flex-row">
	<Header />
	<Sidebar />

	<main class="d-flex flex-fill">
		<slot />
	</main>
</div>

<style>
	.app {
		min-height: 100vh;
	}
</style>
