import { z } from "zod";

export const chatCreateConversationSchema = z.object({
  type: z.enum(["direct", "group", "external_support"]).default("direct"),
  title: z.string().trim().min(1).max(200).optional(),
  memberUserIds: z.array(z.string().uuid()).min(1).max(50),
  metadata: z.record(z.unknown()).optional(),
});

export const chatSendMessageSchema = z.object({
  body: z.string().max(10000).nullish().transform(v => v ?? ""),
  messageType: z.enum(["text", "image", "file", "system"]).default("text"),
  metadata: z.record(z.unknown()).optional(),
  attachmentIds: z.array(z.string().uuid()).optional(),
});

export const chatEditMessageSchema = z.object({
  body: z.string().min(1).max(10000),
});

export const chatUpdateConversationSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  status: z.enum(["open", "pending", "closed", "archived"]).optional(),
  avatarUrl: z.string().url().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const chatAddMembersSchema = z.object({
  userIds: z.array(z.string().uuid()).min(1).max(50),
  role: z.enum(["member", "admin", "operator"]).default("member"),
});

export const chatPresignAttachmentSchema = z.object({
  conversationId: z.string().uuid(),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(255),
  sizeBytes: z.number().int().min(1).max(20 * 1024 * 1024),
});

export const chatGuestSessionSchema = z.object({
  email: z.string().email().optional(),
  name: z.string().trim().max(100).optional(),
  phone: z.string().trim().max(30).optional(),
  websiteId: z.string().uuid().optional(),
  pageUrl: z.string().url().optional(),
  referrer: z.string().url().optional(),
  userAgent: z.string().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const chatGuestMessageSchema = z.object({
  body: z.string().min(1).max(10000),
  messageType: z.enum(["text", "image", "file"]).default("text"),
  metadata: z.record(z.unknown()).optional(),
});

export const chatAssignOperatorSchema = z.object({
  operatorUserId: z.string().uuid(),
});

export const chatCreateChannelSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(500).optional(),
  isPublic: z.boolean().optional().default(false),
  slug: z.string().trim().min(1).max(60).regex(/^[a-z0-9-]+$/, "El slug solo puede contener minusculas, numeros y guiones.").optional(),
  memberUserIds: z.array(z.string().uuid()).max(50).optional().default([]),
});

export const chatCreateChannelRoleSchema = z.object({
  name: z.string().trim().min(1).max(50),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  position: z.number().int().min(0).max(99),
  permissions: z.record(z.boolean()),
});

export const chatUpdateChannelRoleSchema = z.object({
  name: z.string().trim().min(1).max(50).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  position: z.number().int().min(0).max(99).optional(),
  permissions: z.record(z.boolean()).optional(),
});

export const chatAssignMemberRoleSchema = z.object({
  roleId: z.string().uuid(),
});

export const chatPinMessageSchema = z.object({
  pinned: z.boolean(),
});

export const chatToggleReactionSchema = z.object({
  emoji: z.string().trim().min(1).max(16),
});
