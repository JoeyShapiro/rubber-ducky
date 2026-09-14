ALTER TABLE "answers" ADD COLUMN "prompt" text;--> statement-breakpoint
ALTER TABLE "answers" ADD COLUMN "message_id" uuid;--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE no action ON UPDATE no action;