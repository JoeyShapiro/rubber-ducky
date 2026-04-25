CREATE TABLE "answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"promt" text,
	"content" text,
	"timestamp" timestamp with time zone,
	"messages" text
);
--> statement-breakpoint
CREATE TABLE "attachments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"type" text,
	"content" text,
	"embedding" vector(768),
	"message_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "badlings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"description" text,
	"created_on" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ducks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"description" text,
	"created_on" timestamp with time zone,
	"badling_id" uuid
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from" text,
	"content" text,
	"embedding" vector(768),
	"timestamp" timestamp with time zone,
	"duck_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text,
	"embedding" vector(768),
	"duck_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text,
	"description" text,
	"due" text,
	"status" text,
	"done" boolean,
	"created_on" timestamp with time zone,
	"updated_on" timestamp with time zone,
	"quest_parent_id" uuid,
	"duck_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"created_on" timestamp with time zone,
	"expires_on" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ducks" ADD CONSTRAINT "ducks_badling_id_badlings_id_fk" FOREIGN KEY ("badling_id") REFERENCES "public"."badlings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_duck_id_ducks_id_fk" FOREIGN KEY ("duck_id") REFERENCES "public"."ducks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_duck_id_ducks_id_fk" FOREIGN KEY ("duck_id") REFERENCES "public"."ducks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_quest_parent_id_quests_id_fk" FOREIGN KEY ("quest_parent_id") REFERENCES "public"."quests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_duck_id_ducks_id_fk" FOREIGN KEY ("duck_id") REFERENCES "public"."ducks"("id") ON DELETE no action ON UPDATE no action;