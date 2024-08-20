<script lang="ts">
	import { onMount } from "svelte";
	import { duck } from './stores.js';

	class Duck {
		constructor(public name: string) {
			this.name = name;
		}
	}

	let duck_v = new Duck('');

	let text = '';
	let messages: string[] = []; // if not declared, some stuff will not work. but will partly with js

	// TODO use actions
	function handleSubmit(event: Event) {
		event.preventDefault();
		console.log('submit', text);
		
		if (text === '' || duck_v.name === '') {
			return;
		}

		fetch('/messages', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				duck: duck_v.name,
				message: text
			})
		})
			.then(res => res.json())
			.then(data => {
				if (data.success) {
					messages.push(text);
					text = '';
				}
			})
			.catch(err => {
				console.error(err);
			});
	}

	function autoResize(this: HTMLElement) {
		this.style.height = 'auto';
		this.style.height = this.scrollHeight + 'px';
	}

	onMount(() => {
		const textarea = document.getElementById('send-text');
		if (!textarea) {
			console.error('Textarea not found');
			return;
		}

		textarea.addEventListener('input', autoResize);
		// submit on enter, shift+enter for newline
		textarea.addEventListener('keydown', (e: KeyboardEvent) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				let form = (<HTMLFormElement>document.getElementById('form'));
				form.dispatchEvent(new Event('submit'));
			}
		});

		// Initial call to set the correct height
		autoResize.call(textarea);
		
		// has to be here, because "eagerly loaded" components are not loaded yet
		duck.subscribe((value: Duck) => {
			duck_v = value;

			fetch(`/messages?duck=${duck_v.name}`)
				.then(res => res.json())
				.then(data => {
					messages = data.messages;
				})
				.catch(err => {
					console.error(err);
				});
		});
	});
</script>

<svelte:head>
	<title>Home</title>
	<meta name="description" content="Svelte demo app" />
</svelte:head>

<!-- 
style="background-color: rgb(240, 240, 230);"
background-color: rgb(230, 230, 220);
-->

<section class="d-flex flex-column bg-gradient w-100" style="max-height: 100vh;">
	<div id="chatbox" class="flex-column bg-body-tertiary overflow-auto flex-fill">
		{#if messages.length > 0}
		{#each messages as message}
			<div class="toast fade show m-2 w-50" role="alert" aria-live="assertive" aria-atomic="true">
				<div class="toast-header">
					<!-- <svg class="bd-placeholder-img rounded mr-2" width="20" height="20" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice" focusable="false" role="img"><rect fill="#007aff" width="100%" height="100%"></rect></svg> -->
					<strong class="mr-auto m-1" style="">username</strong>
					<small id="date" class="text-muted">time</small>
				</div>
				<div class="toast-body text-body">
					{message}
				</div>
			</div>
		{/each}
		{/if}
	</div>
	<button class="btn btn-toggle rounded border-0 position-fixed end-0 mb-5" style="bottom: 2em;" type="button" id="load-btn"><img src="/magic.svg" alt="magic" class="me-2" width="32" height="32" /></button>
	
	<form class="input-group mb-2 w-100 p-1" on:submit|preventDefault={handleSubmit} id="form">
		<textarea bind:value={text} style="width: auto;" class="form-control auto-resize" aria-label="Sizing example input"
			aria-describedby="inputGroup-sizing-default" placeholder="Message" id="send-text"></textarea>
		<div id="send-btn-listener"> <!-- not sure im keeping the button -->
			<input style="width: auto; height: 100%;" class="btn btn-primary" type="submit"
				id="send-btn" value="Send" />
		</div>
	</form>
</section>

<style>
	.auto-resize {
		resize: none;
		max-height: 33vh;
	}

	.btn-toggle {
  padding: .25rem .5rem;
  font-weight: 600;
  color: var(--bs-emphasis-color);
  background-color: transparent;
  width: 48px !important;
  height: 48px !important;
}
.btn-toggle:hover,
.btn-toggle:focus {
  color: rgba(var(--bs-emphasis-color-rgb), .85);
  background-color: var(--bs-secondary-bg);
}
</style>
