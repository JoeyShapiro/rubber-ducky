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

<section class="d-flex flex-column flex-fill bg-gradient overflow-hidden">
	<div id="chatbox" class="d-flex flex-column flex-fill overflow-auto">
		{#if messages.length > 0}
		{#each messages as message}
			<div class="toast fade show m-2 w-50" role="alert" aria-live="assertive" aria-atomic="true">
				<div class="toast-header">
					<!-- <svg class="bd-placeholder-img rounded mr-2" width="20" height="20" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" focusable="false" role="img"><rect fill="#007aff" width="100%" height="100%"></rect></svg> -->
					<strong class="mr-auto m-1" style="">username</strong>
					<small id="date" class="text-muted">time</small>
				</div>
				<div id="original" hidden>{message}</div>
				<div class="toast-body text-body">
					{message}
				</div>
			</div>
		{/each}
		{/if}
	</div>

	<div id="chat" class="d-flex flex-column flex-fill bg-gradient">
		<form class="input-group mb-3" on:submit|preventDefault={handleSubmit}>
			<input type="text" style="width: auto;" class="form-control" aria-label="Sizing example input"
				aria-describedby="inputGroup-sizing-default" placeholder="Message" id="send-text">
			<div id="send-btn-listener">
				<button style="width: auto; height: 100%;" class="btn btn-primary" type="button"
					id="send-btn">Send</button>
			</div>
		</form>
	</div>
</section>

<style>
</style>
