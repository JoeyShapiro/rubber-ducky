<script lang="ts">
	import type { Duck, Quest, QuestStatus } from '$lib/types';
	import { messages } from '$lib/stores';
	import { createQuest, fetchQuests, setQuestStatus } from '$lib/api';
	import { QUEST_STATUSES, iconForStatus, toStatusClass, toStatusLabel } from '$lib/quests';
	import { enhanceMarkdown, renderMarkdown } from '$lib/markdown';
	import AddButton from './AddButton.svelte';
	import QuestModal from './QuestModal.svelte';

	export let duck: Duck;

	let quests: Quest[] = [];
	let questPath: Quest[] = [];
	let showModal = false;
	let loadedDuck = '';
	let expanded = new Set<string>();

	$: if (duck.uuid !== loadedDuck) {
		loadedDuck = duck.uuid;
		questPath = [];
		expanded = new Set();
		load(duck.uuid);
	}

	$: currentParentId = questPath.length > 0 ? questPath[questPath.length - 1].uuid : '';
	$: subquestCounts = quests.reduce((acc, q) => {
		if (q.quest_parent_id) {
			acc.set(q.quest_parent_id, (acc.get(q.quest_parent_id) || 0) + 1);
		}
		return acc;
	}, new Map<string, number>());
	$: visibleQuests = quests.filter(q => (q.quest_parent_id || '') === currentParentId);
	$: currentQuest = currentParentId
		? quests.find(q => q.uuid === currentParentId) ?? questPath[questPath.length - 1]
		: null;

	async function load(uuid: string) {
		if (!uuid) {
			quests = [];
			return;
		}

		try {
			const data = await fetchQuests(uuid);
			quests = data.quests;
		} catch (err) {
			console.error('quests', err);
		}
	}

	function childrenOf(uuid: string): Quest[] {
		return quests.filter((q) => q.quest_parent_id === uuid);
	}

	function toggle(uuid: string) {
		if (expanded.has(uuid)) expanded.delete(uuid);
		else expanded.add(uuid);
		expanded = expanded; // Set mutation needs the reassignment to be reactive
	}

	function drillInto(quest: Quest) {
		questPath = [...questPath, quest];
	}

	function breadcrumbTo(index: number) {
		questPath = questPath.slice(0, index);
	}

	async function changeStatus(questUuid: string, status: QuestStatus) {
		const quest = quests.find(q => q.uuid === questUuid);

		try {
			const result = await setQuestStatus(questUuid, status, duck.uuid, quest?.title);

			const idx = quests.findIndex(q => q.uuid === questUuid);
			if (idx !== -1) {
				quests[idx].status = status;
				quests[idx].done = status === 'completed';
				quests = [...quests];
			}

			if (result.systemMessage) {
				messages.update(list => [...list, result.systemMessage!]);
			}
		} catch (err) {
			console.error('quests', err);
		}
	}

	// the cast has to live here; svelte 4 does not parse typescript in markup expressions
	function handleStatusChange(questUuid: string, event: Event) {
		const select = event.currentTarget as HTMLSelectElement;
		changeStatus(questUuid, select.value as QuestStatus);
	}

	async function handleAccept(event: CustomEvent<{ title: string; description: string; due: string }>) {
		if (!duck.uuid) return;

		try {
			const data = await createQuest(duck.uuid, { ...event.detail, quest_parent: currentParentId });
			quests = [data.quest, ...quests];
			if (data.systemMessage) messages.update(list => [...list, data.systemMessage!]);
		} catch (err) {
			console.error('quests', err);
		}

		showModal = false;
	}
</script>

<div class="tasks-container mt-2 d-flex flex-column">
	<div class="tasks-header d-flex justify-content-between align-items-center px-3 py-2">
		<div class="breadcrumb-nav d-flex align-items-center gap-1">
			<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
			<span class="breadcrumb-btn {questPath.length === 0 ? 'breadcrumb-current' : ''}" on:click={() => breadcrumbTo(0)}>Quests</span>
			{#each questPath as ancestor, i}
				<span class="breadcrumb-sep">/</span>
				<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
				<span class="breadcrumb-btn {i === questPath.length - 1 ? 'breadcrumb-current' : ''}" on:click={() => breadcrumbTo(i + 1)}>{ancestor.title}</span>
			{/each}
		</div>
		<AddButton
			title={questPath.length > 0 ? 'New subquest' : 'New quest'}
			on:click={() => (showModal = true)}
		/>
	</div>
	<!-- drilled into a quest: its own description sits above its subquests -->
	{#if currentQuest && currentQuest.description.trim() !== ''}
		{@const html = renderMarkdown(currentQuest.description)}
		<div class="quest-brief markdown" use:enhanceMarkdown={html}>{@html html}</div>
	{/if}

	<ul class="tasks-list list-unstyled m-0 p-2">
		{#each visibleQuests as quest}
			{@const children = childrenOf(quest.uuid)}
			{@const isOpen = expanded.has(quest.uuid)}
			<li class="task-item d-flex flex-column rounded-2 mb-1">
				<div class="task-row d-flex align-items-center p-2 gap-2">
					<!-- the count sits on the icon, but as a badge rather than replacing it - the
					     status has to stay readable underneath -->
					{#if children.length > 0}
						<button
							class="task-icon-wrap task-icon-drill {toStatusClass(quest.status)}"
							type="button"
							title="{children.length} subquests ({toStatusLabel(quest.status)})"
							on:click={() => drillInto(quest)}
						>
							<svg class="task-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
								<path d={iconForStatus(quest.status)}></path>
							</svg>
							<span class="task-subcount">{children.length}</span>
						</button>
					{:else}
						<span class="task-icon-wrap {toStatusClass(quest.status)}" title={toStatusLabel(quest.status)}>
							<svg class="task-icon" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
								<path d={iconForStatus(quest.status)}></path>
							</svg>
						</span>
					{/if}

					<button class="task-main d-flex align-items-center gap-2 flex-fill" type="button" on:click={() => toggle(quest.uuid)}>
						<span class="task-title {quest.done ? 'task-done' : ''}">{quest.title}</span>
						{#if quest.due}<small class="task-due">{quest.due}</small>{/if}
						<span class="task-chevron ms-auto" class:open={isOpen} aria-hidden="true">›</span>
					</button>

					<select
						class="form-select form-select-sm task-status-select {toStatusClass(quest.status)} ms-2"
						value={quest.status}
						on:change={(e) => handleStatusChange(quest.uuid, e)}
					>
						{#each QUEST_STATUSES as status}
							<option value={status}>{toStatusLabel(status)}</option>
						{/each}
					</select>
				</div>

				{#if isOpen}
					<div class="task-detail px-2 pb-2">
						{#if quest.description.trim() !== ''}
							{@const html = renderMarkdown(quest.description)}
							<div class="markdown task-description" use:enhanceMarkdown={html}>{@html html}</div>
						{:else}
							<p class="task-empty m-0">No description.</p>
						{/if}

						{#if children.length > 0}
							<ul class="task-children list-unstyled m-0 mt-2">
								{#each children as child}
									<li class="task-child d-flex align-items-center gap-2">
										<span class="task-dot {toStatusClass(child.status)}" title={toStatusLabel(child.status)}></span>
										<span class="{child.done ? 'task-done' : ''}">{child.title}</span>
									</li>
								{/each}
							</ul>
							<button class="task-open-sub mt-2" type="button" on:click={() => drillInto(quest)}>
								Open subquests →
							</button>
						{/if}
					</div>
				{/if}
			</li>
		{/each}
	</ul>
</div>

{#if showModal}
	<QuestModal
		parentTitle={questPath.length > 0 ? questPath[questPath.length - 1].title : ''}
		on:accept={handleAccept}
		on:decline={() => (showModal = false)}
	/>
{/if}

<style>
	.tasks-container {
		background: rgba(248, 248, 255, 0.4);
		-webkit-backdrop-filter: blur(10px);
		backdrop-filter: blur(10px);
		border: 1px solid rgba(212, 212, 250, 0.3);
		border-radius: 8px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
		overflow: hidden;
		min-height: 0;
		/* was 2 against notes' 1, which left notes a third of the column */
		flex: 1.5 1 0;
	}

	.tasks-header {
		background: rgba(212, 212, 250, 0.5);
		border-bottom: 1px solid rgba(212, 212, 250, 0.4);
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
	}

	.tasks-list {
		overflow-y: auto;
	}

	/* caps at a third of the card and scrolls, so a long description can never crowd out the
	   subquests you drilled in to see */
	.quest-brief {
		flex: 0 1 auto;
		max-height: 30%;
		overflow-y: auto;
		margin: 0.5rem 0.5rem 0;
		padding: 0.5rem 0.65rem;
		font-size: 0.84rem;
		background: rgba(255, 255, 255, 0.45);
		border: 1px solid rgba(212, 212, 250, 0.4);
		border-radius: 6px;
	}

	.task-item {
		background: rgba(255, 255, 255, 0.45);
		border: 1px solid rgba(212, 212, 250, 0.35);
	}

	/* the whole title area is the expand target, so it is a real button - the status select and
	   the subquest chip sit outside it rather than nested inside an interactive element */
	.task-main {
		background: none;
		border: none;
		padding: 0.25rem;
		color: inherit;
		text-align: left;
		cursor: pointer;
		min-width: 0;
	}

	.task-chevron {
		font-size: 1.1rem;
		line-height: 1;
		opacity: 0.4;
		transition: transform 0.15s ease;
		transform: rotate(90deg);
	}

	.task-chevron.open {
		transform: rotate(-90deg);
	}

	.task-detail {
		font-size: 0.84rem;
		border-top: 1px solid rgba(212, 212, 250, 0.4);
		padding-top: 0.5rem;
		margin: 0 0.25rem;
	}

	.task-empty {
		font-size: 0.8rem;
		font-style: italic;
		color: rgba(108, 117, 125, 0.85);
	}

	.task-child {
		font-size: 0.82rem;
		padding: 0.15rem 0;
	}

	.task-dot {
		width: 0.55rem;
		height: 0.55rem;
		border-radius: 999px;
		flex-shrink: 0;
		background: currentColor;
	}

	.task-open-sub {
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0.15rem 0.55rem;
		border-radius: 999px;
		border: 1px solid rgba(94, 106, 158, 0.4);
		background: none;
		color: inherit;
		cursor: pointer;
	}

	.task-open-sub:hover {
		background: rgba(94, 106, 158, 0.12);
	}

	.task-item:last-child {
		margin-bottom: 0 !important;
	}

	.task-title {
		font-size: 0.92rem;
		font-weight: 500;
	}

	.task-icon-wrap {
		position: relative;
		width: 1.8rem;
		height: 1.8rem;
		padding: 0;
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
		flex-shrink: 0;
	}

	.task-description {
		font-size: 0.84rem;
		line-height: 1.45;
		color: rgba(58, 58, 70, 0.86);
	}

	.task-status-select {
		width: 8rem;
		flex-shrink: 0;
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
		transform: translateX(4px);
		pointer-events: none;
		transition: opacity 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
	}

	.task-item:hover .task-status-select,
	.task-item:focus-within .task-status-select {
		opacity: 1;
		visibility: visible;
		transform: translateX(0);
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

	.breadcrumb-nav {
		min-width: 0;
		overflow: hidden;
	}

	.breadcrumb-btn {
		font-size: 0.85rem;
		font-weight: 600;
		color: rgba(0, 0, 0, 0.55);
		cursor: pointer;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		max-width: 10rem;
		user-select: none;
		transition: color 0.12s ease;
	}

	.breadcrumb-btn:hover {
		color: rgba(0, 0, 0, 0.85);
	}

	.breadcrumb-btn.breadcrumb-current {
		color: rgba(0, 0, 0, 0.8);
	}

	.breadcrumb-sep {
		font-size: 0.8rem;
		color: rgba(0, 0, 0, 0.3);
		flex-shrink: 0;
	}

	.task-icon-drill {
		cursor: pointer;
		transition: filter 0.12s ease, transform 0.12s ease;
	}

	.task-icon-drill:hover {
		filter: brightness(1.15);
		transform: scale(1.08);
	}

	.task-subcount {
		position: absolute;
		top: -0.2rem;
		right: -0.25rem;
		min-width: 0.95rem;
		height: 0.95rem;
		padding: 0 0.18rem;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		background: rgba(55, 58, 75, 0.92);
		color: rgba(255, 255, 255, 0.95);
		font-size: 0.62rem;
		font-weight: 700;
		line-height: 1;
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

	:global(:root[data-theme="dark"]) .task-description {
		color: rgba(196, 196, 210, 0.85);
	}

	:global(:root[data-theme="dark"]) .task-subcount {
		background: rgba(225, 228, 240, 0.92);
		color: rgba(30, 30, 40, 0.95);
	}

	:global(:root[data-theme="dark"]) .quest-brief {
		background: rgba(35, 35, 33, 0.7);
		border-color: rgba(80, 80, 80, 0.45);
	}

	:global(:root[data-theme="dark"]) .task-detail {
		border-top-color: rgba(88, 88, 88, 0.5);
	}

	:global(:root[data-theme="dark"]) .task-empty {
		color: rgba(175, 180, 195, 0.8);
	}

	:global(:root[data-theme="dark"]) .task-open-sub {
		border-color: rgba(140, 150, 195, 0.45);
	}

	/* matches the notes header, so the two panels read as one surface */
	:global(:root[data-theme="dark"]) .tasks-header {
		background: rgba(52, 56, 72, 0.7);
	}

	:global(:root[data-theme="dark"]) .breadcrumb-btn {
		color: rgba(232, 232, 232, 0.6);
	}

	:global(:root[data-theme="dark"]) .breadcrumb-btn:hover,
	:global(:root[data-theme="dark"]) .breadcrumb-btn.breadcrumb-current {
		color: rgba(232, 232, 232, 0.9);
	}

	:global(:root[data-theme="dark"]) .breadcrumb-sep {
		color: rgba(232, 232, 232, 0.35);
	}
</style>
