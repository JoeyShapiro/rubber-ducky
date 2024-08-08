<script lang="ts">
	let messages: string[] = [];

	function handleSubmit(event: Event) {
		console.log('submit');
		event.preventDefault();
		const input = (event.target as HTMLFormElement)?.querySelector('input') as HTMLInputElement;

		messages = [...messages, input.value];
		input.value = '';
	}
</script>

<svelte:head>
	<title>Home</title>
	<meta name="description" content="Svelte demo app" />
</svelte:head>

<section>
	{#if messages.length > 0}
		<ul>
			{#each messages as message}
				<li>{message}</li>
			{/each}
		</ul>
	{/if}

	<form on:submit|preventDefault={handleSubmit}>
		<input type="text" placeholder="Type something..." />
		<input type="submit" value="Add message" />
	</form>
</section>

<style>
	section {
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		flex: 0.6;
	}
</style>
