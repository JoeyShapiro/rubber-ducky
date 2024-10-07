<script lang="ts">
	import { onMount } from "svelte";
	import { duck, hidden } from './stores.js';
	import { Attachment, Message, Duck } from "$lib/types";
	import hljs from 'highlight.js/lib/core';
	import 'highlight.js/styles/default.css'; // need to get the styles

	// window size
	// videos
	// small font
	// functionize
	// tasks
	// reply
	// add colors to login
	// escape markdown
	// qna get

	let duck_v = new Duck('', '');

	let text = '';
	let messages: Message[] = []; // if not declared, some stuff will not work. but will partly with js
	let attachments: Attachment[] = [];

	let loading = false;
	let offset = 0;
	let languages: string[] = [];
	let question = false;

	function getCookie(name: string): string | undefined {
		const value = `; ${document.cookie}`;
		const parts = value.split(`; ${name}=`);
		if (parts.length === 2) return parts.pop().split(';').shift();
	}

	async function metaRegisterLanguage(name: string) {
		try {
			// this is dumb, but i cant get dynamic imports to work
			// https://github.com/highlightjs/highlight.js/blob/main/SUPPORTED_LANGUAGES.md
			let module: any;
			switch (name) {
				case 'javascript':
					module = await import('highlight.js/lib/languages/javascript');
					break;
				case 'typescript':
					module = await import('highlight.js/lib/languages/typescript');
					break;
				case 'python':
					module = await import('highlight.js/lib/languages/python');
					break;
				case 'java':
					module = await import('highlight.js/lib/languages/java');
					break;
				case 'c':
					module = await import('highlight.js/lib/languages/c');
					break;
				case 'cpp':
					module = await import('highlight.js/lib/languages/cpp');
					break;
				case 'csharp':
					module = await import('highlight.js/lib/languages/csharp');
					break;
				case 'go':
					module = await import('highlight.js/lib/languages/go');
					break;
				case 'rust':
					module = await import('highlight.js/lib/languages/rust');
					break;
				case 'ruby':
					module = await import('highlight.js/lib/languages/ruby');
					break;
				case 'php':
					module = await import('highlight.js/lib/languages/php');
					break;
				case 'swift':
					module = await import('highlight.js/lib/languages/swift');
					break;
				case 'kotlin':
					module = await import('highlight.js/lib/languages/kotlin');
					break;
				
				// Add more cases for other languages you need
				default:
					throw new Error(`Unsupported language: ${name}`);
			}
			// const module = await import(/* @vite-ignore */ `highlight.js/lib/languages/${name}`);
			hljs.registerLanguage(name, module.default);
		} catch (error) {
			console.error(`Failed to load language: ${name}`, error);
			throw error;
		}
	}

	// TODO use actions
	async function handleSubmit(event: Event) {
		event.preventDefault();
		console.log('submit', text);
		
		if (text === '' || duck_v.name === '') {
			return;
		}

		if (question) {
			fetch('/qna', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					duck: duck_v.uuid,
					prompt: text,
					session: getCookie('session') || ''
				})
			})
				.then(res => {
					if (res.status == 200) {
					return res.json()
					} else {
					throw res;
					}
				})
				.then(data => {
					messages = [...messages, data.message]; // force update
				})
				.catch(err => {
					// check the status code
					// if 401, redirect to login
					if (err.status === 401) {
						window.location.href = `${window.location.origin}/login`;
					}
				});

			question = false;
		}

		fetch('/messages', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				duck: duck_v.uuid,
				message: text
			})
		})
			.then(res => res.json())
			.then(data => {
				messages = [...messages, data.message]; // force update
				text = '';
				let promises = [];

				for (let i = 0; i < attachments.length; i++) {
					promises.push(fetch('/attachments', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({
							message: data.message.uuid,
							attachment: attachments[i]
						})
					})
						.then(res => res.json())
						.then(data => {
							attachments[i].uuid = data.attachment.uuid;
							if (!attachments[i].type.includes('image')) {
								attachments[i].content = '';
							}

							// link to message
							messages = messages.map(m => {
								if (m.uuid === data.message) {
									m.attachments.push(attachments[i]);
								}
								return m;
							});
						})
						.catch(err => {
							console.error(err);
						})
					);
				}

				Promise.all(promises)
					.then(() => {
						attachments = [];
					});
			})
			.catch(err => {
				// check the status code
				// if 401, redirect to login
				if (err.status === 401) {
					window.location.href = `${window.location.origin}/login`;
				}
			});
	}

	// idk what this does, but it works
	// not sure what full is, it should have "...args", but this works, and i dont need them
	// https://stackoverflow.com/questions/33631041/javascript-async-await-in-replace
	async function replaceAsync(str: string, regex: any, asyncFn: (full: string) => any) {
		const promises: any[] = [];
		str.replace(regex, (full) => {
			promises.push(asyncFn(full));
			return full;
		});
		const data = await Promise.all(promises);
		return str.replace(regex, () => data.shift());
	}

	function onLoadMessage(node: HTMLElement) {
		// whatever man, this fuckin works
		// i might want to use an #await, but this seems more fitting
		async function markdown() {
			// add precode to any code block
			// could just await this in html. but that would require a more complex class
			await replaceAsync(node.innerHTML, /```(.*?)```/gs, async (p1) => {
				let language = p1.split('\n')[0].replace('```', '');

				// if the language is not in the list, add it
				if (!languages.includes(language)) {
					await metaRegisterLanguage(language)
						.then(() => {
							languages.push(language);
						})
						.catch(err => {
							console.error(err);
						});
				}

				return `<pre class="card p-2 d-inline-block" style="background: rgba(212, 212, 250, 0.3);"><code>${hljs.highlight(p1, { language }).value}</code></pre>`;
			})
			.then((data) => {
				node.innerHTML = data;
			});

			// add code to any inline code block (shrug)
			node.innerHTML = node.innerHTML.replace(/(?<!`)`[^`\n]+`(?!`)/gs, (p1) => {
				return `<code>${p1}</code>`;
			});

			// do markdown stuff because i cant be bothered to use lib
			// ai overlords did it :P
			node.innerHTML = node.innerHTML.replace(/(?<!\\)\*\*(.*?)\*\*/gs, '<strong>$1</strong>');
			node.innerHTML = node.innerHTML.replace(/(?<!\\)\*(.*?)\*/gs, '<em>$1</em>');
			node.innerHTML = node.innerHTML.replace(/(?<!\\)~~(.*?)~~/gs, '<del>$1</del>');
			node.innerHTML = node.innerHTML.replace(/(?<!\\)__(.*?)__/gs, '<u>$1</u>');
			node.innerHTML = node.innerHTML.replace(/(?<!\\)\[(.*?)\]\((.*?)\)/gs, '<a href="$2">$1</a>');
			// spoilers
			node.innerHTML = node.innerHTML.replace(/(?<!\\)\|\|(.*?)\|\|/gs, '<span class="spoil">$1</span>');
		}

		markdown();
		scrollToBottom();

		return {
			destroy() {
				// Cleanup code if needed
			}
		};
	}

	function autoResize(this: HTMLElement) {
		this.style.height = 'auto';
		this.style.height = this.scrollHeight + 'px';
	}

	// scroll to the botton of the chat log
	function scrollToBottom() {
		var chatbox = document.getElementById('chatbox');
		
		if (chatbox?.lastElementChild !== null) {
			// Scroll to the bottom with smooth animation
			chatbox!.lastElementChild.scrollIntoView({ behavior: 'smooth' });
		}
	}

	function formatDate(date: Date): string {
		date = new Date(date); // shrug
		const now = new Date();
		const hours = date.getHours();
		const minutes = date.getMinutes();
		const ampm = hours >= 12 ? 'PM' : 'AM';
		const formattedHours = hours % 12 || 12;
		const formattedMinutes = minutes.toString().padStart(2, '0');

		if (date.toDateString() === now.toDateString()) {
			return `today at ${formattedHours}:${formattedMinutes} ${ampm}`;
		} else if (date.getTime() - now.getTime() < 24 * 60 * 60 * 1000 && 
					date.getTime() > now.getTime()) {
			return `tomorrow at ${formattedHours}:${formattedMinutes} ${ampm}`;
		} else if (now.getTime() - date.getTime() < 24 * 60 * 60 * 1000 && 
					date.getTime() < now.getTime()) {
			return `yesterday at ${formattedHours}:${formattedMinutes} ${ampm}`;
		} else {
			return date.toLocaleDateString() + ` at ${formattedHours}:${formattedMinutes} ${ampm}`;
		}
	}

	function handleFileSelect(event: Event) {
		const files = (event.target as HTMLInputElement)?.files;
		if (!files) {
			return;
		}

		for (let i = 0; i < files.length; i++) {
			const file = files[i];
			const reader = new FileReader();
			reader.onload = function (e) {
				attachments.push(new Attachment('', e.target?.result as string, file.name, file.type));
				attachments = [...attachments];
			};
			reader.readAsDataURL(file);
		}
	}

	async function loadMoreData() {
		loading = true;
		offset = messages.length;
		fetch(`/messages?duck=${duck_v.uuid}&offset=${offset}`)
		.then(res => res.json())
			.then(data => {
				messages = [...data.messages, ...messages];
			})
			.catch(err => {
				console.error(err);
				// check the status code
				// if 401, redirect to login
				if (err.status === 401) {
					window.location.href = `${window.location.origin}/login`;
				}
			})
			.finally(() => {
				loading = false;
			});
	}

	function handleScroll() {
		const doomScroll = window.innerHeight + window.scrollY <= (document.body.offsetHeight - 10); // threshold of 10
		if (doomScroll && !loading) { // window.scrollY === 0
			loadMoreData();
			console.log('loading more data');
		}
	}

	onMount(() => {
		document.onpaste = function (event) {
		var items = event.clipboardData?.items as DataTransferItemList; // readd if errors `event.originalEvent.clipboardData`
		console.log(JSON.stringify(items)); // might give you mime types
		for (var index in items) {
			var item = items[index];
			if (item.kind === 'file') {
				console.log(item);

				var blob = item.getAsFile();
				if (!blob) {
					console.error('No blob');
					return;
				}
				
				var reader = new FileReader();
				reader.onload = function (event) {
					// console.log(event.target.result); // data url!

					// split data url
					var parts = (event.target?.result as string).split(';');

					attachments.push(new Attachment('', parts[0], blob!.name, parts[1]));
					// image - data:image/png;base64,
					// src file - data:application/octet-stream;base64,
					// docx - data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,
					attachments = [...attachments];
				}; 
				reader.readAsDataURL(blob);

				// prevent pasting image in contenteditable
				event.preventDefault();
			}
		}
	};

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

			fetch(`/messages?duck=${duck_v.uuid}`)
				.then(res => res.json())
				.then(data => {
					messages = data.messages;
					
					// if a message contains an image, fetch the data
					for (let i = 0; i < messages.length; i++) {
						for (let j = 0; j < messages[i].attachments.length; j++) {
							if (messages[i].attachments[j].type.includes('image')) {
								fetch(`/attachments?uuid=${messages[i].attachments[j].uuid}`)
									.then(data => {
										return data.blob();
									})
									.then(blob => {
										messages[i].attachments[j].content = URL.createObjectURL(blob);

										// best i can think of
										// find the image and set the src
										let img = document.getElementById(messages[i].attachments[j].uuid) as HTMLImageElement;
										if (img) {
											img.src = messages[i].attachments[j].content;
											// Remember to revoke the URL when you're done with the image
											img.onload = () => URL.revokeObjectURL(messages[i].attachments[j].content);
										} else {
											console.error(`Image ${messages[i].attachments[j].uuid} not found`);
										}
									})
									.catch(err => {
										console.error(err);
										// check the status code
										// if 401, redirect to login
										if (err.status === 401) {
											window.location.href = `${window.location.origin}/login`;
										}
									});
							}
						}
					}

					scrollToBottom();
					// maybe not, what about scrolling up
				})
				.catch(err => {
					console.error('messages', err);
				});
		});

		window.addEventListener('scroll', handleScroll);

		return () => {
			window.removeEventListener('scroll', handleScroll);
		};
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
		{#if loading}
			<div class="alert alert-info mt-2">Loading...</div>
		{/if}
		{#if messages.length > 0}
		<!-- need the uuid to stop list oddness -->
		{#each messages as message (message.uuid)}
			<div use:onLoadMessage class="toast fade show m-2 w-50 position-relative {$hidden ? 'spoil' : ''}" role="alert" aria-live="assertive" aria-atomic="true">
				<div class="toast-body text-body mb-2" style="min-height: 4rem;">
					{#if message.from != 'user'}{message.from}: {/if}{@html message.content}
					{#if message.attachments.length > 0}
						{#each message.attachments as attachment}
							{#if attachment.type.includes('image')}
								<img id={attachment.uuid} src={attachment.content} alt={attachment.name} style="max-width: 100%" />
							{:else}
							<div class="card acrylic m-1 flip-card-inner">
								<div class="card-body">
									<img src="/cute-doc.svg" alt="duck" class="me-2" width="32" height="32" />
									<a href="/attachments?uuid={attachment.uuid}">{attachment.name}</a>
								</div>
							</div>
							{/if}
						{/each}
					{/if}
				</div>
				<small id="date" class="text-muted position-absolute m-1 bottom-0 end-0">{formatDate(message.timestamp)}</small>
			</div>
		{/each}
		{/if}
	</div>
	<button on:click={() => question = !question} class="btn btn-toggle rounded border-0 position-fixed end-0 mb-5" style="bottom: 2em;" type="button" id="load-btn"><img src="/magic.svg" alt="magic" class="me-2" width="32" height="32" /></button>
	
	<form class="input-group mb-2 w-100 p-1" on:submit|preventDefault={handleSubmit} id="form">
		<button type="button" class="btn btn-outline-secondary position-relative" on:click={() => document.getElementById('input-file')?.click()}>
			<img src="/attachment.svg" alt="attachment" class="me-2" width="16" height="16" />
			{#if attachments.length > 0}
				<span class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
					{attachments.length}
				</span>
			{/if}
		</button>
		<textarea bind:value={text} style="width: auto;" class="form-control auto-resize" aria-label="Sizing example input"
			aria-describedby="inputGroup-sizing-default" placeholder="Message" id="send-text"></textarea>
		<input type="file" id="input-file" accept="*" on:change={handleFileSelect} style="display: none;">
		<div id="send-btn-listener"> <!-- not sure im keeping the button -->
			<input style="width: auto; height: 100%; { question ? 'background-color: #ba34eb !important;' : '' }" class="btn btn-warning" type="submit"
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

.acrylic {
	background: rgba(212, 212, 250, 0.3);
	-webkit-backdrop-filter: blur(10px);
	backdrop-filter: blur(10px);
}
</style>
