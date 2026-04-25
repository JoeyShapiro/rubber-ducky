import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import type * as schema from './schema';
import { badlings, ducks, messages, quests } from './schema';

export async function seed(db: PostgresJsDatabase<typeof schema>) {
    const existing = await db.select().from(badlings).limit(1);
    if (existing.length > 0) return;

    await db.insert(badlings).values([
        { id: 'a0000000-0000-0000-0000-000000000001', name: 'Projects', description: 'My projects', createdOn: new Date() },
        { id: 'a0000000-0000-0000-0000-000000000002', name: 'Games', description: 'shrug', createdOn: new Date() },
        { id: 'a0000000-0000-0000-0000-000000000003', name: 'Misc', description: 'Misc (however you spell it) ideas and thoughts', createdOn: new Date() },
    ]);

    await db.insert(ducks).values([
        { id: 'd0000000-0000-0000-0000-000000000001', name: 'rubber-ducky', description: 'A rubber duck', createdOn: new Date(), badlingId: 'a0000000-0000-0000-0000-000000000001' },
        { id: 'd0000000-0000-0000-0000-000000000002', name: 'coca', description: 'A coca', createdOn: new Date(), badlingId: 'a0000000-0000-0000-0000-000000000001' },
        { id: 'd0000000-0000-0000-0000-000000000003', name: 'quake', description: 'A quake', createdOn: new Date(), badlingId: 'a0000000-0000-0000-0000-000000000001' },
        { id: 'd0000000-0000-0000-0000-000000000004', name: 'dota', description: 'A dota', createdOn: new Date(), badlingId: 'a0000000-0000-0000-0000-000000000002' },
        { id: 'd0000000-0000-0000-0000-000000000005', name: 'Ideas', description: 'random ideas i have', createdOn: new Date(), badlingId: 'a0000000-0000-0000-0000-000000000003' },
        { id: 'd0000000-0000-0000-0000-000000000006', name: 'talk', description: 'random things to talk about', createdOn: new Date(), badlingId: 'a0000000-0000-0000-0000-000000000003' },
    ]);

    await db.insert(messages).values([
        { id: 'e0000000-0000-0000-0000-000000000001', from: 'user', content: 'Hello world', timestamp: new Date(), duckId: 'd0000000-0000-0000-0000-000000000001' },
        { id: 'e0000000-0000-0000-0000-000000000002', from: 'user', content: 'vecdb', timestamp: new Date(), duckId: 'd0000000-0000-0000-0000-000000000001' },
        { id: 'e0000000-0000-0000-0000-000000000003', from: 'user', content: 'svelte', timestamp: new Date(), duckId: 'd0000000-0000-0000-0000-000000000001' },
        { id: 'e0000000-0000-0000-0000-000000000004', from: 'user', content: 'this is a very long message. i use weaviate as the db which is a vector db. svelte is the front end. of course i use bootstrap. svelte is also my backend... i think that is about it', timestamp: new Date(), duckId: 'd0000000-0000-0000-0000-000000000001' },
        { id: 'e0000000-0000-0000-0000-000000000005', from: 'user', content: 'fireship gave a tutorial on how to use this all', timestamp: new Date(), duckId: 'd0000000-0000-0000-0000-000000000001' },
        { id: 'e0000000-0000-0000-0000-000000000006', from: 'user', content: 'the docs have good data, but it isnt very helpful', timestamp: new Date(), duckId: 'd0000000-0000-0000-0000-000000000001' },
        { id: 'e0000000-0000-0000-0000-000000000007', from: 'user', content: '```c\ninclude <stdio.h>\nint main() {\nprintf("hello");\nreturn0;\n}```', timestamp: new Date(), duckId: 'd0000000-0000-0000-0000-000000000001' },
        { id: 'e0000000-0000-0000-0000-000000000008', from: 'user', content: '`test`', timestamp: new Date(), duckId: 'd0000000-0000-0000-0000-000000000001' },
        { id: 'e0000000-0000-0000-0000-000000000009', from: 'user', content: '`python test.py`', timestamp: new Date(), duckId: 'd0000000-0000-0000-0000-000000000001' },
        { id: 'e0000000-0000-0000-0000-000000000010', from: 'user', content: '`docker compose up --build -d`', timestamp: new Date(), duckId: 'd0000000-0000-0000-0000-000000000001' },
        { id: 'e0000000-0000-0000-0000-000000000011', from: 'user', content: '`bun schema.ts`', timestamp: new Date(), duckId: 'd0000000-0000-0000-0000-000000000001' },
    ]);

    await db.insert(quests).values([
        { id: 'f0000000-0000-0000-0000-000000000001', title: 'Add Quest persistence', description: 'Wire quests to Weaviate so they survive a page reload.', status: 'completed', done: true, createdOn: new Date(), updatedOn: new Date(), questParentId: null, duckId: 'd0000000-0000-0000-0000-000000000001' },
        { id: 'f0000000-0000-0000-0000-000000000002', title: 'Support subtasks', description: 'Allow quests to have child quests via questParentId references.', status: 'completed', done: true, createdOn: new Date(), updatedOn: new Date(), questParentId: null, duckId: 'd0000000-0000-0000-0000-000000000001' },
        { id: 'f0000000-0000-0000-0000-000000000003', title: 'Add due date picker', description: 'Replace the plain text due field with a real date input in the modal.', status: 'active', done: false, createdOn: new Date(), updatedOn: new Date(), questParentId: null, duckId: 'd0000000-0000-0000-0000-000000000001' },
        { id: 'f0000000-0000-0000-0000-000000000004', title: 'Quest filtering', description: 'Add a filter bar to show only active, completed, or aborted quests.', status: 'inactive', done: false, createdOn: new Date(), updatedOn: new Date(), questParentId: null, duckId: 'd0000000-0000-0000-0000-000000000001' },
        { id: 'f0000000-0000-0000-0000-000000000005', title: 'Design questParentId schema', description: 'Add questParentId text property to the Quest collection.', status: 'completed', done: true, createdOn: new Date(), updatedOn: new Date(), questParentId: 'f0000000-0000-0000-0000-000000000002', duckId: 'd0000000-0000-0000-0000-000000000001' },
        { id: 'f0000000-0000-0000-0000-000000000006', title: 'Update API endpoints', description: 'Pass quest_parent in POST body; return it in the response.', status: 'completed', done: true, createdOn: new Date(), updatedOn: new Date(), questParentId: 'f0000000-0000-0000-0000-000000000002', duckId: 'd0000000-0000-0000-0000-000000000001' },
        { id: 'f0000000-0000-0000-0000-000000000007', title: 'Build breadcrumb UI', description: 'Show a clickable breadcrumb trail when drilling into subquests.', status: 'completed', done: true, createdOn: new Date(), updatedOn: new Date(), questParentId: 'f0000000-0000-0000-0000-000000000002', duckId: 'd0000000-0000-0000-0000-000000000001' },
        { id: 'f0000000-0000-0000-0000-000000000008', title: 'Replace icon with count', description: 'Show child count on the icon when a quest has subquests.', status: 'completed', done: true, createdOn: new Date(), updatedOn: new Date(), questParentId: 'f0000000-0000-0000-0000-000000000002', duckId: 'd0000000-0000-0000-0000-000000000001' },
        { id: 'f0000000-0000-0000-0000-000000000009', title: 'Add date input to modal', description: 'Swap the plain text due field for an <input type="date">.', status: 'active', done: false, createdOn: new Date(), updatedOn: new Date(), questParentId: 'f0000000-0000-0000-0000-000000000003', duckId: 'd0000000-0000-0000-0000-000000000001' },
        { id: 'f0000000-0000-0000-0000-000000000010', title: 'Format date for display', description: 'Show a human-readable date string on the quest card.', status: 'inactive', done: false, createdOn: new Date(), updatedOn: new Date(), questParentId: 'f0000000-0000-0000-0000-000000000003', duckId: 'd0000000-0000-0000-0000-000000000001' },
    ]);
}
