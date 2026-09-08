-- chat_attachments: WOPI/Office editing support.
-- Chat core tables are raw-SQL (not in schema.prisma); accessed via $queryRaw.
ALTER TABLE "chat_attachments"
  ADD COLUMN "content_revision"       INTEGER     NOT NULL DEFAULT 1,
  ADD COLUMN "checksum"               TEXT,
  ADD COLUMN "office_lock"            TEXT,
  ADD COLUMN "office_lock_expires_at" TIMESTAMPTZ,
  ADD COLUMN "updated_at"             TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Prior revisions of an Office-edited chat attachment. Recovery pointers only
-- reachable through the privileged Atlas API.
CREATE TABLE "chat_attachment_versions" (
  "id"            UUID        NOT NULL DEFAULT uuidv7(),
  "attachment_id" UUID        NOT NULL,
  "revision"      INTEGER     NOT NULL,
  "bucket"        TEXT        NOT NULL,
  "object_key"    TEXT        NOT NULL,
  "file_name"     TEXT        NOT NULL,
  "mime_type"     TEXT        NOT NULL,
  "size_bytes"    BIGINT      NOT NULL DEFAULT 0,
  "checksum"      TEXT,
  "created_at"    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "chat_attachment_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "chat_attachment_versions_att_fkey"
    FOREIGN KEY ("attachment_id") REFERENCES "chat_attachments"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "chat_attachment_versions_att_revision_key"
  ON "chat_attachment_versions" ("attachment_id", "revision");

ALTER TABLE "chat_attachment_versions" ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON "chat_attachment_versions" FROM anon, authenticated;
