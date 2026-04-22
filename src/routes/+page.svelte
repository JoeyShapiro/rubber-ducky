<script lang="ts">
	import { onMount } from "svelte";
	import { duck, hidden } from './stores.js';
	import { Attachment, Message, Duck, Quest, type QuestStatus } from "$lib/types";
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
	// import export
	// model
	// link
	// attachments dont work
	// still feels odd

	let duck_v = new Duck('', '');

	let text = '';
	let messages: Message[] = []; // if not declared, some stuff will not work. but will partly with js
	let attachments: Attachment[] = [];
	let notes = '';
	let savedNotes = ''; // Track the last saved note content

	let loading = false;
	let offset = 0;
	let languages: string[] = [];
	let question = false;

	const taskStatuses: QuestStatus[] = ['active', 'inactive', 'completed', 'aborted', 'locked'];
	let quests: Quest[] = [];
	let showTaskModal = false;
	let newTaskTitle = '';
	let newTaskDescription = '';

	function toStatusLabel(status: QuestStatus): string {
		switch (status) {
			case 'active': return 'Active';
			case 'inactive': return 'Inactive';
			case 'completed': return 'Completed';
			case 'aborted': return 'Aborted';
			case 'locked': return 'Locked';
		}
	}

	function toStatusClass(status: QuestStatus): string {
		return `task-status-${status}`;
	}

	function iconForStatus(status: QuestStatus): string {
		switch (status) {
			case 'active':
				return 'M8 1.5l2.08 4.21 4.65.68-3.36 3.27.79 4.63L8 12.1l-4.16 2.19.79-4.63-3.36-3.27 4.65-.68L8 1.5z';
			case 'inactive':
				return 'M8 1.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zm0 2a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z';
			case 'completed':
				return 'M13.5 3.5a1 1 0 0 1 0 1.4l-6.3 6.3a1 1 0 0 1-1.4 0L2.5 7.9a1 1 0 1 1 1.4-1.4l2.6 2.6 5.6-5.6a1 1 0 0 1 1.4 0z';
			case 'aborted':
				return 'M3.3 2.3a1 1 0 0 1 1.4 0L8 5.6l3.3-3.3a1 1 0 1 1 1.4 1.4L9.4 7l3.3 3.3a1 1 0 0 1-1.4 1.4L8 8.4l-3.3 3.3a1 1 0 0 1-1.4-1.4L6.6 7 3.3 3.7a1 1 0 0 1 0-1.4z';
			case 'locked':
				return 'M5 6V4.8A3 3 0 0 1 8 1.8a3 3 0 0 1 3 3V6h.5A1.5 1.5 0 0 1 13 7.5v5A1.5 1.5 0 0 1 11.5 14h-7A1.5 1.5 0 0 1 3 12.5v-5A1.5 1.5 0 0 1 4.5 6H5zm2 0h2V4.8A1 1 0 0 0 8 3.8a1 1 0 0 0-1 1V6z';
		}
	}

	async function setQuestStatus(index: number, status: QuestStatus) {
		const quest = quests[index];
		await fetch('/quests', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ uuid: quest.uuid, status }),
		});
		quests[index].status = status;
		quests[index].done = status === 'completed';
		quests = [...quests];
	}

	function handleTaskStatusChange(index: number, event: Event) {
		const select = event.currentTarget as HTMLSelectElement;
		setQuestStatus(index, select.value as QuestStatus);
	}

	function openTaskModal() {
		showTaskModal = true;
	}

	function declineTaskModal() {
		showTaskModal = false;
		newTaskTitle = '';
		newTaskDescription = '';
	}

	async function acceptTaskModal() {
		const title = newTaskTitle.trim();
		if (title === '' || !duck_v.uuid) return;

		const res = await fetch('/quests', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				duck: duck_v.uuid,
				title,
				description: newTaskDescription.trim(),
				due: '',
			}),
		});
		const data = await res.json();
		quests = [data.quest, ...quests];

		declineTaskModal();
	}

	function getCookie(name: string): string | undefined {
		const value = `; ${document.cookie}`;
		const parts = value.split(`; ${name}=`);
		if (parts.length === 2) {
			const part = parts.pop();
			if (!part) return undefined;
			return part.split(';').shift();
		}
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

	async function handleSaveNotes() {
		fetch('/notes', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				duck: duck_v.uuid,
				notes: notes
			})
		})
			.then(res => res.json())
			.then(data => {
				savedNotes = notes;
				console.log('Notes saved');
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
			node.innerHTML = node.innerHTML.replace(/(?<!\\)\n/g, '<br>');
			node.innerHTML = node.innerHTML.replace(/https?:\/\/\S+/g, (p1) => {
				return `<a href="${p1}">${p1}</a>`;
			});
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

			fetch(`/notes?duck=${duck_v.uuid}`)
				.then(res => res.json())
				.then(data => {
					notes = data.notes ? data.notes.content : '';
					savedNotes = notes;
				})
				.catch(err => {
					console.error('notes', err);
				});

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

			fetch(`/quests?duck=${duck_v.uuid}`)
				.then(res => res.json())
				.then(data => {
					quests = data.quests;
				})
				.catch(err => {
					console.error('quests', err);
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

<section class="d-flex flex-row bg-gradient w-100" style="max-height: 100vh;">
	<!-- Left side: Chat and input -->
	<div class="d-flex flex-column w-50 position-relative">
		<div id="chatbox" class="flex-column bg-body-tertiary overflow-auto flex-fill">
			{#if loading}
				<div class="alert alert-info mt-2">Loading...</div>
			{/if}
			{#if messages.length > 0}
			<!-- need the uuid to stop list oddness -->
			{#each messages as message (message.uuid)}
				<div use:onLoadMessage class="toast fade show m-2 w-75 position-relative {$hidden ? 'spoil' : ''}" role="alert" aria-live="assertive" aria-atomic="true">
					<div class="toast-body text-body mb-2" style="min-height: 4rem;">
						{#if message.from != 'user'}{message.from}: {/if}{@html message.content}
						{#if message.attachments.length > 0}
							{#each message.attachments as attachment}
								{#if attachment.type.includes('image')}
									<!-- TODO something is wrong. first upload breaks it, but others dont. maybe different paths -->
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

		<button on:click={() => question = !question} class="btn btn-toggle rounded border-0 position-absolute" style="bottom: 4.5em; right: 1em;" type="button" id="load-btn"><img src="/magic.svg" alt="magic" class="me-2" width="32" height="32" /></button>
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
	</div>

	<!-- Right side: Notes -->
	<!-- TODO add my own git db for this lol -->
	<div class="d-flex flex-column w-50 p-3 right-panel">
		<div class="notes-container d-flex flex-column">
			<div class="notes-header d-flex justify-content-between align-items-center px-3 py-2">
				<span class="notes-title fw-semibold">Notes</span>
				<button class="btn btn-sm btn-warning" on:click={handleSaveNotes} disabled={notes === savedNotes}>Save</button>
			</div>
			<textarea bind:value={notes} class="notes-area flex-fill p-3" placeholder="Notes..."></textarea>
		</div>

		<div class="tasks-container mt-3 d-flex flex-column">
			<div class="tasks-header d-flex justify-content-between align-items-center px-3 py-2">
				<span class="tasks-title fw-semibold">Quests</span>
				<button class="btn btn-sm btn-warning" on:click={openTaskModal} type="button">New Quest</button>
			</div>
			<ul class="tasks-list list-unstyled m-0 p-3">
				{#each quests as quest, index}
					<li class="task-item d-flex align-items-start p-3 rounded-2 mb-2">
						<!-- TODO use skyrim symbols -->
						<div class="task-icon-wrap {toStatusClass(quest.status)}" title={toStatusLabel(quest.status)} aria-hidden="true">
							<svg class="task-icon" viewBox="0 0 16 16" fill="currentColor">
								<path d={iconForStatus(quest.status)}></path>
							</svg>
						</div>
						<!-- todo support sub tasks. symbol will also have number instead of status -->
						<div class="task-copy d-flex flex-column w-100 gap-2">
							<div class="d-flex justify-content-between align-items-center gap-2">
								<span class="task-title {quest.done ? 'task-done' : ''}">{quest.title}</span>
								{#if quest.due}<small class="task-due">{quest.due}</small>{/if}
							</div>
							{#if quest.description !== ''}
								<p class="task-description m-0">{quest.description}</p>
							{/if}
							<div class="d-flex justify-content-end align-items-center gap-2">
								<select
									class="form-select form-select-sm task-status-select {toStatusClass(quest.status)}"
									value={quest.status}
									on:change={(e) => handleTaskStatusChange(index, e)}
								>
									{#each taskStatuses as status}
										<option value={status}>{toStatusLabel(status)}</option>
									{/each}
								</select>
							</div>
						</div>
					</li>
				{/each}
			</ul>
		</div>
	</div>
</section>

{#if showTaskModal}
	<div class="task-modal-backdrop" on:click={(e) => e.target === e.currentTarget && declineTaskModal()} role="presentation">
		<div class="task-modal card" role="dialog" aria-modal="true" aria-label="Create task">
			<div class="task-modal-header d-flex justify-content-between align-items-center px-3 py-2">
				<h2 class="task-modal-title m-0">Create New Quest</h2>
			</div>
			<div class="task-modal-body p-3">
				<label class="form-label mb-1" for="task-title">Title</label>
				<input id="task-title" class="form-control mb-3" bind:value={newTaskTitle} placeholder="Quest title" maxlength="120" />

				<label class="form-label mb-1" for="task-description">Description</label>
				<textarea id="task-description" class="form-control" bind:value={newTaskDescription} placeholder="Describe the quest..." rows="4"></textarea>
			</div>
			<div class="task-modal-footer d-flex justify-content-end gap-2 px-3 pb-3">
				<button type="button" class="btn btn-outline-secondary" on:click={declineTaskModal}>Decline</button>
				<button type="button" class="btn btn-warning" on:click={acceptTaskModal} disabled={newTaskTitle.trim() === ''}>Accept</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.auto-resize {
		resize: none;
		max-height: 33vh;
	}

	.notes-container {
		background: rgba(248, 248, 255, 0.4);
		-webkit-backdrop-filter: blur(10px);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(212, 212, 250, 0.3);
		border-radius: 8px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
		overflow: hidden;
		min-height: 0;
		flex: 1 1 0;
	}

	.notes-header {
		background: rgba(212, 212, 250, 0.5);
		border-bottom: 1px solid rgba(212, 212, 250, 0.4);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
	}

	.notes-title {
		color: rgba(0, 0, 0, 0.75);
		font-size: 0.9rem;
		user-select: none;
	}

	.notes-area {
		background: transparent;
		border: none !important;
		border-radius: 0;
		font-size: 0.95rem;
		line-height: 1.6;
		transition: all 0.2s ease;
		resize: none;
		overflow-y: auto;
		min-height: 0;
	}

	.notes-area:focus {
		outline: none;
		background: rgba(255, 255, 255, 0.2);
	}

	.notes-area::placeholder {
		color: rgba(108, 117, 125, 0.5);
		font-style: italic;
	}

	.tasks-container {
		background: rgba(248, 248, 255, 0.4);
		-webkit-backdrop-filter: blur(10px);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(212, 212, 250, 0.3);
		border-radius: 8px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
		overflow: hidden;
		min-height: 0;
		flex: 2 1 0;
	}

	.right-panel {
		min-height: 0;
	}

	.tasks-header {
		background: rgba(212, 212, 250, 0.5);
		border-bottom: 1px solid rgba(212, 212, 250, 0.4);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
	}

	.tasks-title {
		color: rgba(0, 0, 0, 0.75);
		font-size: 0.9rem;
		user-select: none;
	}

	.tasks-chip {
		font-size: 0.75rem;
		padding: 0.2rem 0.6rem;
		border-radius: 999px;
		background: rgba(255, 193, 7, 0.2);
		border: 1px solid rgba(255, 193, 7, 0.45);
		color: rgba(86, 61, 0, 0.9);
	}

	.tasks-list {
		overflow-y: auto;
	}

	.task-item {
		background: rgba(255, 255, 255, 0.45);
		border: 1px solid rgba(212, 212, 250, 0.35);
		gap: 0.75rem;
	}

	.task-item:last-child {
		margin-bottom: 0 !important;
	}

	.task-title {
		font-size: 0.92rem;
		font-weight: 500;
	}

	.task-icon-wrap {
		width: 1.8rem;
		height: 1.8rem;
		border-radius: 999px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border: 1px solid transparent;
		flex-shrink: 0;
	}

	.task-icon {
		width: 0.95rem;
		height: 0.95rem;
	}

	.task-icon-wrap.task-status-active {
		background: rgba(25, 135, 84, 0.12);
		color: rgba(13, 110, 66, 0.95);
		border-color: rgba(25, 135, 84, 0.25);
	}

	.task-icon-wrap.task-status-inactive {
		background: rgba(108, 117, 125, 0.12);
		color: rgba(73, 80, 87, 0.95);
		border-color: rgba(108, 117, 125, 0.3);
	}

	.task-icon-wrap.task-status-completed {
		background: rgba(13, 202, 240, 0.12);
		color: rgba(5, 110, 140, 0.95);
		border-color: rgba(13, 202, 240, 0.3);
	}

	.task-icon-wrap.task-status-aborted {
		background: rgba(220, 53, 69, 0.12);
		color: rgba(132, 32, 41, 0.95);
		border-color: rgba(220, 53, 69, 0.3);
	}

	.task-icon-wrap.task-status-locked {
		background: rgba(255, 193, 7, 0.16);
		color: rgba(108, 77, 2, 0.95);
		border-color: rgba(255, 193, 7, 0.35);
	}

	.task-done {
		text-decoration: line-through;
		opacity: 0.65;
	}

	.task-due {
		color: rgba(108, 117, 125, 0.9);
	}

	.task-description {
		font-size: 0.84rem;
		line-height: 1.45;
		color: rgba(58, 58, 70, 0.86);
	}

	.task-status-select {
		max-width: 9.5rem;
		font-size: 0.78rem;
		line-height: 1.2;
		padding-top: 0.25rem;
		padding-bottom: 0.25rem;
		padding-left: 0.7rem;
		padding-right: 1.8rem;
		border-radius: 999px;
		font-weight: 600;
		border-width: 1px;
		border-style: solid;
		appearance: none;
		-webkit-appearance: none;
		background-image:
			linear-gradient(45deg, transparent 50%, currentColor 50%),
			linear-gradient(135deg, currentColor 50%, transparent 50%);
		background-position:
			calc(100% - 14px) calc(50% - 2px),
			calc(100% - 9px) calc(50% - 2px);
		background-size: 5px 5px, 5px 5px;
		background-repeat: no-repeat;
		opacity: 0;
		visibility: hidden;
		transform: translateY(2px);
		pointer-events: none;
		transition: opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
	}

	.task-item:hover .task-status-select,
	.task-item:focus-within .task-status-select {
		opacity: 1;
		visibility: visible;
		transform: translateY(0);
		pointer-events: auto;
	}

	.task-status-select:focus {
		outline: none;
		transform: translateY(-1px);
		box-shadow: 0 0 0 0.16rem rgba(255, 193, 7, 0.22);
	}

	.task-status-select.task-status-active {
		background: rgba(25, 135, 84, 0.12);
		color: rgba(13, 110, 66, 0.95);
		border-color: rgba(25, 135, 84, 0.25);
	}

	.task-status-select.task-status-inactive {
		background: rgba(108, 117, 125, 0.12);
		color: rgba(73, 80, 87, 0.95);
		border-color: rgba(108, 117, 125, 0.3);
	}

	.task-status-select.task-status-completed {
		background: rgba(13, 202, 240, 0.12);
		color: rgba(5, 110, 140, 0.95);
		border-color: rgba(13, 202, 240, 0.3);
	}

	.task-status-select.task-status-aborted {
		background: rgba(220, 53, 69, 0.12);
		color: rgba(132, 32, 41, 0.95);
		border-color: rgba(220, 53, 69, 0.3);
	}

	.task-status-select.task-status-locked {
		background: rgba(255, 193, 7, 0.16);
		color: rgba(108, 77, 2, 0.95);
		border-color: rgba(255, 193, 7, 0.35);
	}

	:global(:root[data-theme="dark"]) .task-item {
		background: rgba(35, 35, 33, 0.75);
		border-color: rgba(80, 80, 80, 0.45);
	}

	:global(:root[data-theme="dark"]) .task-icon-wrap.task-status-active {
		background: rgba(32, 201, 151, 0.2);
		color: rgba(145, 255, 222, 0.95);
		border-color: rgba(32, 201, 151, 0.35);
	}

	:global(:root[data-theme="dark"]) .task-icon-wrap.task-status-inactive {
		background: rgba(173, 181, 189, 0.16);
		color: rgba(222, 226, 230, 0.92);
		border-color: rgba(173, 181, 189, 0.3);
	}

	:global(:root[data-theme="dark"]) .task-icon-wrap.task-status-completed {
		background: rgba(13, 202, 240, 0.2);
		color: rgba(156, 236, 255, 0.95);
		border-color: rgba(13, 202, 240, 0.35);
	}

	:global(:root[data-theme="dark"]) .task-icon-wrap.task-status-aborted {
		background: rgba(220, 53, 69, 0.22);
		color: rgba(255, 185, 191, 0.95);
		border-color: rgba(220, 53, 69, 0.35);
	}

	:global(:root[data-theme="dark"]) .task-icon-wrap.task-status-locked {
		background: rgba(255, 193, 7, 0.2);
		color: rgba(255, 230, 156, 0.95);
		border-color: rgba(255, 193, 7, 0.35);
	}

	:global(:root[data-theme="dark"]) .tasks-title {
		color: rgba(232, 232, 232, 0.92);
	}

	:global(:root[data-theme="dark"]) .task-status-select.task-status-active {
		background: rgba(32, 201, 151, 0.2);
		color: rgba(145, 255, 222, 0.95);
		border-color: rgba(32, 201, 151, 0.35);
	}

	:global(:root[data-theme="dark"]) .task-status-select.task-status-inactive {
		background: rgba(173, 181, 189, 0.16);
		color: rgba(222, 226, 230, 0.92);
		border-color: rgba(173, 181, 189, 0.3);
	}

	:global(:root[data-theme="dark"]) .task-status-select.task-status-completed {
		background: rgba(13, 202, 240, 0.2);
		color: rgba(156, 236, 255, 0.95);
		border-color: rgba(13, 202, 240, 0.35);
	}

	:global(:root[data-theme="dark"]) .task-status-select.task-status-aborted {
		background: rgba(220, 53, 69, 0.22);
		color: rgba(255, 185, 191, 0.95);
		border-color: rgba(220, 53, 69, 0.35);
	}

	:global(:root[data-theme="dark"]) .task-status-select.task-status-locked {
		background: rgba(255, 193, 7, 0.2);
		color: rgba(255, 230, 156, 0.95);
		border-color: rgba(255, 193, 7, 0.35);
	}

	:global(:root[data-theme="dark"]) .task-status-select {
		background-color: rgba(25, 25, 24, 0.75);
		border-color: rgba(173, 181, 189, 0.28);
		color: var(--text-primary);
	}

	:global(:root[data-theme="dark"]) .tasks-chip {
		background: rgba(255, 193, 7, 0.15);
		color: rgba(255, 224, 143, 0.95);
		border-color: rgba(255, 193, 7, 0.3);
	}

	:global(:root[data-theme="dark"]) .task-description {
		color: rgba(196, 196, 210, 0.85);
	}

	.task-modal-backdrop {
		position: fixed;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		background: rgba(18, 18, 28, 0.42);
		backdrop-filter: blur(3px);
		-webkit-backdrop-filter: blur(3px);
		z-index: 1100;
	}

	.task-modal {
		width: min(560px, 100%);
		background: rgba(248, 248, 255, 0.96);
		border: 1px solid rgba(212, 212, 250, 0.5);
		border-radius: 12px;
		box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
	}

	.task-modal-header {
		background: rgba(212, 212, 250, 0.45);
		border-bottom: 1px solid rgba(212, 212, 250, 0.5);
	}

	.task-modal-title {
		font-size: 1rem;
		font-weight: 650;
		color: rgba(33, 33, 44, 0.9);
	}

	:global(:root[data-theme="dark"]) .task-modal {
		background: rgba(35, 35, 33, 0.97);
		border-color: rgba(88, 88, 88, 0.45);
	}

	:global(:root[data-theme="dark"]) .task-modal-header {
		background: rgba(55, 55, 52, 0.8);
		border-bottom-color: rgba(88, 88, 88, 0.5);
	}

	:global(:root[data-theme="dark"]) .task-modal-title {
		color: rgba(234, 234, 234, 0.95);
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
