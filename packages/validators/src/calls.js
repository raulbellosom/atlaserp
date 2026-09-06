import { z } from "zod";

export const callLinkPatchSchema = z.object({
  requireLobby: z.boolean().optional(),
  maxUses: z.number().int().positive().max(500).nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export const callInviteSchema = z.object({
  emails: z.array(z.string().email()).min(1).max(50),
});

export const callGuestJoinSchema = z
  .object({
    token: z.string().min(1).max(128).optional(),
    code: z.string().min(1).max(32).optional(),
    inviteToken: z.string().min(1).max(128).optional(),
    displayName: z.string().trim().min(2).max(40),
    email: z.string().email().optional(),
  })
  .refine((v) => v.token || v.code || v.inviteToken, {
    message: "Se requiere un enlace, código o invitación.",
  });

export const callRoomMessageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

export const callGuestModerationSchema = z.object({
  muted: z.boolean(),
});
