<script lang="ts">
	import { duck } from '$lib/stores';
	import Chat from '$lib/components/Chat.svelte';
	import Notes from '$lib/components/Notes.svelte';
	import Quests from '$lib/components/Quests.svelte';
</script>

<svelte:head>
	<title>Home</title>
	<meta name="description" content="Svelte demo app" />
</svelte:head>

<section class="d-flex flex-row bg-gradient w-100" style="max-height: 100vh;">
	<Chat duck={$duck} />

	<div class="d-flex flex-column w-50 p-3 right-panel">
		<Notes duck={$duck} />
		<Quests duck={$duck} />
	</div>
</section>

<style>
	.right-panel {
		min-height: 0;
	}
</style>
