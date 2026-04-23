import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';

export const quests = pgTable('quests', {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title'),
    description: text('description'),
    due: text('due'),
    status: text('status'),
    done: boolean('done'),
    createdOn: timestamp('created_on', { withTimezone: true }),
    updatedOn: timestamp('updated_on', { withTimezone: true }),
    questParentId: uuid('quest_parent_id'),
    duckId: uuid('duck_id').notNull(),
});
