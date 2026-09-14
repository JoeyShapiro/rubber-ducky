import { pgTable, uuid, text, boolean, timestamp, customType, type AnyPgColumn } from 'drizzle-orm/pg-core';

const vector = customType<{ data: number[]; driverData: string }>({
    dataType() {
        return 'vector(768)';
    },
    toDriver(value: number[]): string {
        return `[${value.join(',')}]`;
    },
    fromDriver(value: string): number[] {
        return JSON.parse(value);
    },
});

export const sessions = pgTable('sessions', {
    id: uuid('id').primaryKey().defaultRandom(),
    createdOn: timestamp('created_on', { withTimezone: true }),
    expiresOn: timestamp('expires_on', { withTimezone: true }),
});

export const badlings = pgTable('badlings', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name'),
    description: text('description'),
    createdOn: timestamp('created_on', { withTimezone: true }),
});

export const ducks = pgTable('ducks', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name'),
    description: text('description'),
    createdOn: timestamp('created_on', { withTimezone: true }),
    badlingId: uuid('badling_id').references(() => badlings.id),
});

export const messages = pgTable('messages', {
    id: uuid('id').primaryKey().defaultRandom(),
    from: text('from'),
    content: text('content'),
    embedding: vector('embedding'),
    timestamp: timestamp('timestamp', { withTimezone: true }),
    // a duck's or a badling's id - never a plain FK, since a column can't reference two tables.
    // duck and badling ids are both defaultRandom() uuids from disjoint tables, so collision
    // isn't a real risk, and every caller already knows which kind of id it is holding.
    parentId: uuid('parent_id').notNull(),
});

export const attachments = pgTable('attachments', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name'),
    type: text('type'),
    content: text('content'),
    embedding: vector('embedding'),
    messageId: uuid('message_id').notNull().references(() => messages.id),
});

// The record of an AI exchange: the prompt, the reply, and the message the reply was posted as.
// The reply itself lives in `messages` with from = 'ai', so the log is one table and pagination
// needs no merging. This row exists to keep the prompt alongside it for later search.
export const answers = pgTable('answers', {
    id: uuid('id').primaryKey().defaultRandom(),
    prompt: text('prompt'),
    content: text('content'),
    timestamp: timestamp('timestamp', { withTimezone: true }),
    messageId: uuid('message_id').references(() => messages.id),
});

// many notes per duck or badling. the title is a lookup key, and there is no completion state -
// a note is true or stale, and stale notes get deleted. see docs/PLAN.md, W3.
export const notes = pgTable('notes', {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull().default(''),
    content: text('content').notNull().default(''),
    createdOn: timestamp('created_on', { withTimezone: true }).notNull().defaultNow(),
    updatedOn: timestamp('updated_on', { withTimezone: true }),
    embedding: vector('embedding'),
    // a duck's or a badling's id - see messages.parentId
    parentId: uuid('parent_id').notNull(),
});

export const quests = pgTable('quests', {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title'),
    description: text('description'),
    due: text('due'),
    status: text('status'),
    done: boolean('done'),
    createdOn: timestamp('created_on', { withTimezone: true }),
    updatedOn: timestamp('updated_on', { withTimezone: true }),
    questParentId: uuid('quest_parent_id').references((): AnyPgColumn => quests.id),
    // a duck's or a badling's id - see messages.parentId
    parentId: uuid('parent_id').notNull(),
});
