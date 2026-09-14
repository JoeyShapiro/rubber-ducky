<script lang="ts">
	import { scope } from '$lib/stores';
	import Chat from '$lib/components/Chat.svelte';
	import Notes from '$lib/components/Notes.svelte';
	import Quests from '$lib/components/Quests.svelte';
</script>

<svelte:head>
	<title>Home</title>
	<meta name="description" content="Svelte demo app" />
</svelte:head>

<!-- the background lives here, not on the chat pane, so both columns sit on one surface -->
<section class="app-surface d-flex flex-row w-100" style="max-height: 100vh;">
	<Chat scope={$scope} />

	<div class="d-flex flex-column w-50 p-2 right-panel">
		<Notes scope={$scope} />
		<Quests scope={$scope} />
	</div>
</section>

<style>
	.right-panel {
		min-height: 0;
	}
</style>
