-- CreateTable: entity_comment — generic comment table replacing task_comment
CREATE TABLE IF NOT EXISTS "entity_comment" (
  "id"          UUID          NOT NULL DEFAULT uuidv7(),
  "company_id"  UUID          NOT NULL,
  "entity_type" VARCHAR(100)  NOT NULL,
  "entity_id"   UUID          NOT NULL,
  "author_id"   UUID          NOT NULL,
  "body"        VARCHAR(5000) NOT NULL,
  "created_at"  TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "edited_at"   TIMESTAMP(3),
  CONSTRAINT "entity_comment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "entity_comment_entity_type_entity_id_idx" ON "entity_comment"("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "entity_comment_company_id_entity_type_entity_id_idx" ON "entity_comment"("company_id", "entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "entity_comment_author_id_idx" ON "entity_comment"("author_id");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'entity_comment_author_id_fkey'
  ) THEN
    ALTER TABLE "entity_comment"
      ADD CONSTRAINT "entity_comment_author_id_fkey"
      FOREIGN KEY ("author_id") REFERENCES "user_profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable: entity_comment_mention
CREATE TABLE IF NOT EXISTS "entity_comment_mention" (
  "id"         UUID NOT NULL DEFAULT uuidv7(),
  "comment_id" UUID NOT NULL,
  "user_id"    UUID NOT NULL,
  CONSTRAINT "entity_comment_mention_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "entity_comment_mention_comment_id_user_id_key" ON "entity_comment_mention"("comment_id", "user_id");
CREATE INDEX IF NOT EXISTS "entity_comment_mention_comment_id_idx" ON "entity_comment_mention"("comment_id");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'entity_comment_mention_comment_id_fkey'
  ) THEN
    ALTER TABLE "entity_comment_mention"
      ADD CONSTRAINT "entity_comment_mention_comment_id_fkey"
      FOREIGN KEY ("comment_id") REFERENCES "entity_comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'entity_comment_mention_user_id_fkey'
  ) THEN
    ALTER TABLE "entity_comment_mention"
      ADD CONSTRAINT "entity_comment_mention_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable: entity_comment_reaction
CREATE TABLE IF NOT EXISTS "entity_comment_reaction" (
  "id"         UUID         NOT NULL DEFAULT uuidv7(),
  "comment_id" UUID         NOT NULL,
  "user_id"    UUID         NOT NULL,
  "emoji"      VARCHAR(10)  NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "entity_comment_reaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "entity_comment_reaction_comment_id_user_id_emoji_key" ON "entity_comment_reaction"("comment_id", "user_id", "emoji");
CREATE INDEX IF NOT EXISTS "entity_comment_reaction_comment_id_idx" ON "entity_comment_reaction"("comment_id");

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'entity_comment_reaction_comment_id_fkey'
  ) THEN
    ALTER TABLE "entity_comment_reaction"
      ADD CONSTRAINT "entity_comment_reaction_comment_id_fkey"
      FOREIGN KEY ("comment_id") REFERENCES "entity_comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'entity_comment_reaction_user_id_fkey'
  ) THEN
    ALTER TABLE "entity_comment_reaction"
      ADD CONSTRAINT "entity_comment_reaction_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "user_profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Migrate existing task_comment rows → entity_comment (only if source table still exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_comment') THEN
    INSERT INTO "entity_comment" (id, company_id, entity_type, entity_id, author_id, body, created_at, edited_at)
    SELECT
      tc.id,
      p.company_id,
      'Task',
      tc.task_id,
      tc.author_id,
      tc.body,
      tc.created_at,
      tc.edited_at
    FROM "task_comment" tc
    JOIN "task" t ON t.id = tc.task_id
    JOIN "project" p ON p.id = t.project_id
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Migrate task_mention rows → entity_comment_mention (only if source table still exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_mention') THEN
    INSERT INTO "entity_comment_mention" (id, comment_id, user_id)
    SELECT tm.id, tm.comment_id, tm.user_id
    FROM "task_mention" tm
    WHERE EXISTS (SELECT 1 FROM "entity_comment" ec WHERE ec.id = tm.comment_id)
    ON CONFLICT (comment_id, user_id) DO NOTHING;
  END IF;
END $$;

-- Migrate task_comment_reaction rows → entity_comment_reaction (only if source table still exists)
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'task_comment_reaction') THEN
    INSERT INTO "entity_comment_reaction" (id, comment_id, user_id, emoji, created_at)
    SELECT tcr.id, tcr.comment_id, tcr.user_id, tcr.emoji, tcr.created_at
    FROM "task_comment_reaction" tcr
    WHERE EXISTS (SELECT 1 FROM "entity_comment" ec WHERE ec.id = tcr.comment_id)
    ON CONFLICT (comment_id, user_id, emoji) DO NOTHING;
  END IF;
END $$;
