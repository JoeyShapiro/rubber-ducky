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
    duckId: uuid('duck_id').notNull().references(() => ducks.id),
});

export const attachments = pgTable('attachments', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name'),
    type: text('type'),
    content: text('content'),
    embedding: vector('embedding'),
    messageId: uuid('message_id').notNull().references(() => messages.id),
});

export const answers = pgTable('answers', {
    id: uuid('id').primaryKey().defaultRandom(),
    promt: text('promt'),
    content: text('content'),
    timestamp: timestamp('timestamp', { withTimezone: true }),
    messages: text('messages'),
});

// many notes per duck. the title is a lookup key, and there is no completion state - a note is
// true or stale, and stale notes get deleted. see docs/PLAN.md, W3.
export const notes = pgTable('notes', {
    id: uuid('id').primaryKey().defaultRandom(),
    title: text('title').notNull().default(''),
    content: text('content').notNull().default(''),
    createdOn: timestamp('created_on', { withTimezone: true }).notNull().defaultNow(),
    updatedOn: timestamp('updated_on', { withTimezone: true }),
    embedding: vector('embedding'),
    duckId: uuid('duck_id').notNull().references(() => ducks.id),
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
    duckId: uuid('duck_id').notNull().references(() => ducks.id),
});
