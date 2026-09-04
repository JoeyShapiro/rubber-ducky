import type { QuestStatus } from '$lib/types';

export const QUEST_STATUSES: QuestStatus[] = ['active', 'inactive', 'completed', 'aborted', 'locked'];

export function toStatusLabel(status: QuestStatus): string {
    switch (status) {
        case 'active': return 'Active';
        case 'inactive': return 'Inactive';
        case 'completed': return 'Completed';
        case 'aborted': return 'Aborted';
        case 'locked': return 'Locked';
    }
}

export function toStatusClass(status: QuestStatus): string {
    return `task-status-${status}`;
}

// system messages read "Quest "foo" -> completed", so the status is the last word
export function statusFromSystemMessage(content: string): string {
    const match = content.match(/(\w+)$/);
    return match ? match[1] : '';
}

// TODO use skyrim symbols
export function iconForStatus(status: QuestStatus): string {
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
