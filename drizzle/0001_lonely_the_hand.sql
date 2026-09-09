ALTER TABLE "notes" ALTER COLUMN "content" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "notes" ALTER COLUMN "content" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "title" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "created_on" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "notes" ADD COLUMN "updated_on" timestamp with time zone;