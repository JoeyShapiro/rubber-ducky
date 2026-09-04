<script lang="ts">
	import type { Duck, Quest, QuestStatus } from '$lib/types';
	import { messages } from '$lib/stores';
	import { createQuest, fetchQuests, setQuestStatus } from '$lib/api';
	import { QUEST_STATUSES, iconForStatus, toStatusClass, toStatusLabel } from '$lib/quests';
	import QuestModal from './QuestModal.svelte';

	export let duck: Duck;

	let quests: Quest[] = [];
	let questPath: Quest[] = [];
	let showModal = false;
	let loadedDuck = '';

	$: if (duck.uuid !== loadedDuck) {
		loadedDuck = duck.uuid;
		questPath = [];
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
		} catch (err) {
			console.error('quests', err);
		}

		showModal = false;
	}
</script>

<div class="tasks-container mt-3 d-flex flex-column">
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
		<button class="btn btn-sm btn-warning" on:click={() => (showModal = true)} type="button">
			{questPath.length > 0 ? 'New Subquest' : 'New Quest'}
		</button>
	</div>
	<ul class="tasks-list list-unstyled m-0 p-3">
		{#each visibleQuests as quest}
			<li class="task-item d-flex align-items-start p-3 rounded-2 mb-2">
				{#if subquestCounts.get(quest.uuid)}
					<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
					<div class="task-icon-wrap {toStatusClass(quest.status)} task-icon-drill" title="{subquestCounts.get(quest.uuid)} subquests" on:click={() => drillInto(quest)}>
						<span class="task-subcount">{subquestCounts.get(quest.uuid)}</span>
					</div>
				{:else}
					<div class="task-icon-wrap {toStatusClass(quest.status)}" title={toStatusLabel(quest.status)} aria-hidden="true">
						<svg class="task-icon" viewBox="0 0 16 16" fill="currentColor">
							<path d={iconForStatus(quest.status)}></path>
						</svg>
					</div>
				{/if}
				<div class="task-copy d-flex flex-column w-100 gap-1">
					<div class="d-flex align-items-center gap-2">
						<span class="task-title {quest.done ? 'task-done' : ''}">{quest.title}</span>
						{#if quest.due}<small class="task-due ms-auto">{quest.due}</small>{/if}
					</div>
					{#if quest.description !== ''}
						<p class="task-description m-0">{quest.description}</p>
					{/if}
				</div>
				<select
					class="form-select form-select-sm task-status-select {toStatusClass(quest.status)} align-self-center ms-2"
					value={quest.status}
					on:change={(e) => handleStatusChange(quest.uuid, e)}
				>
					{#each QUEST_STATUSES as status}
						<option value={status}>{toStatusLabel(status)}</option>
					{/each}
				</select>
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
		flex: 2 1 0;
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
		opacity: 0;
		transition: opacity 0.15s ease;
	}

	.task-item:hover .task-due {
		opacity: 1;
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
		font-size: 0.75rem;
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

	:global(:root[data-theme="dark"]) .breadcrumb-btn {
		color: rgba(0, 0, 0, 0.45);
	}

	:global(:root[data-theme="dark"]) .breadcrumb-btn:hover,
	:global(:root[data-theme="dark"]) .breadcrumb-btn.breadcrumb-current {
		color: rgba(0, 0, 0, 0.75);
	}

	:global(:root[data-theme="dark"]) .breadcrumb-sep {
		color: rgba(0, 0, 0, 0.3);
	}
</style>
