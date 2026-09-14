-- Messages, notes, and quests can now belong to a badling directly, not only to a duck.
-- duck_id becomes parent_id: a duck's or a badling's id, never both, and never neither. Both
-- tables hand out random uuids, so collision isn't a real risk - and it drops the FK, since a
-- plain foreign key can only point at one table. Existing rows keep pointing at their duck; no
-- data changes, only what the column is allowed to mean.
ALTER TABLE "messages" DROP CONSTRAINT "messages_duck_id_ducks_id_fk";--> statement-breakpoint
ALTER TABLE "messages" RENAME COLUMN "duck_id" TO "parent_id";--> statement-breakpoint
ALTER TABLE "notes" DROP CONSTRAINT "notes_duck_id_ducks_id_fk";--> statement-breakpoint
ALTER TABLE "notes" RENAME COLUMN "duck_id" TO "parent_id";--> statement-breakpoint
ALTER TABLE "quests" DROP CONSTRAINT "quests_duck_id_ducks_id_fk";--> statement-breakpoint
ALTER TABLE "quests" RENAME COLUMN "duck_id" TO "parent_id";
