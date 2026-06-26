-- Allow chat_attachments.message_id to be NULL so attachments can be
-- pre-created (presign upload) before the message row exists.
-- sendMessage updates message_id to the real ID after inserting the message.
ALTER TABLE "chat_attachments" ALTER COLUMN "message_id" DROP NOT NULL;
