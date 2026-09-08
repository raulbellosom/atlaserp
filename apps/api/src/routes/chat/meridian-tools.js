// apps/api/src/routes/chat/meridian-tools.js
//
// Read-only tools for the MeridIAn chat assistant (Spec 1). Every tool is
// scoped to the caller: get_recent_messages / get_conversation_messages /
// list_conversation_files go through chatService.listMessages, which
// membership-checks and throws ChatServiceError; search_my_conversations goes
// through chatSearchService, already scoped to the caller's conversations.
// describe_image verifies the attachment belongs to a conversation the caller
// is a live member of before sending any bytes to the vision model.
// search_atlas (ERP reach, Fase A) reuses the global-search providers, gated
// per provider by the caller's own permissions.
import { SEARCH_PROVIDERS } from "../../services/search-providers.js";

const RECENT_MAX = 50;
const SEARCH_MAX = 30;
const FILES_MAX = 50;

export const TOOL_DEFS = [
  {
    type: "function",
    function: {
      name: "get_recent_messages",
      description: "Devuelve los mensajes recientes de la conversacion actual (la que el usuario tiene abierta con MeridIAn o desde donde se te invoco).",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "integer", description: "Cuantos mensajes traer (max 50, por defecto 30).", minimum: 1, maximum: RECENT_MAX },
          before: { type: "string", description: "ISO timestamp: trae mensajes anteriores a esta fecha (paginacion)." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_my_conversations",
      description: "Busca mensajes por texto en TODAS las conversaciones de las que el usuario es miembro. Usa esto cuando el usuario pregunta por algo que se dijo en otro chat.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Texto a buscar." },
          limit: { type: "integer", description: "Max resultados (max 30, por defecto 15).", minimum: 1, maximum: SEARCH_MAX },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_conversation_messages",
      description: "Devuelve los mensajes recientes de UNA conversacion concreta por id. Solo funciona si el usuario es miembro de esa conversacion.",
      parameters: {
        type: "object",
        properties: {
          conversationId: { type: "string", description: "Id de la conversacion." },
          limit: { type: "integer", minimum: 1, maximum: RECENT_MAX },
          before: { type: "string" },
        },
        required: ["conversationId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_conversation_files",
      description: "Lista los archivos e imagenes compartidos en una conversacion (por defecto la actual): nombre, tipo, quien lo envio y cuando. Para describir una imagen usa despues describe_image con su attachmentId.",
      parameters: {
        type: "object",
        properties: {
          conversationId: { type: "string", description: "Id de la conversacion; por defecto la actual." },
          limit: { type: "integer", minimum: 1, maximum: FILES_MAX },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "describe_image",
      description: "Describe el contenido de una imagen adjunta del chat. Pasa el attachmentId (lo obtienes de get_recent_messages o list_conversation_files). Solo imagenes.",
      parameters: {
        type: "object",
        properties: {
          attachmentId: { type: "string" },
          question: { type: "string", description: "Pregunta concreta sobre la imagen (opcional)." },
        },
        required: ["attachmentId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_atlas",
      description: "Busca registros del ERP por nombre, correo o telefono: contactos (clientes/proveedores), usuarios del sistema y empleados. Usalo cuando el usuario pregunta por una persona o empresa que podria estar en Atlas ('tienes el correo de Juan Perez', 'que datos hay de la empresa X'). Solo devuelve lo que el usuario ya tiene permiso de ver.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "Nombre, correo, telefono o codigo a buscar." } },
        required: ["query"],
      },
    },
  },
];

function trimMessage(m) {
  return {
    senderName: m.sender?.displayName ?? (m.sender_type === "assistant" ? "MeridIAn" : m.sender_type === "system" ? "sistema" : "desconocido"),
    senderType: m.sender_type,
    body: m.deleted_at ? "(mensaje eliminado)" : String(m.body ?? "").slice(0, 2000),
    messageType: m.message_type,
    sentAt: m.created_at instanceof Date ? m.created_at.toISOString() : String(m.created_at),
    attachmentCount: m.attachment_count ?? (m.attachments?.length ?? 0),
    attachmentIds: (m.attachments ?? []).map((a) => a.id),
  };
}

export function buildToolRunners({ prisma, listMessages, chatSearchService, visionService, signAttachmentUrl, resolveUserContext }) {
  async function get_recent_messages(args, ctx) {
    const limit = Math.min(Math.max(parseInt(args?.limit, 10) || 30, 1), RECENT_MAX);
    try {
      const res = await listMessages({
        conversationId: ctx.conversationId, authUserId: ctx.actorAuthUserId,
        limit, before: args?.before || null,
      });
      return { messages: (res.data ?? []).map(trimMessage) };
    } catch (err) {
      return { error: err?.status === 403 || err?.status === 404 ? "Sin acceso a esa conversacion." : `No se pudo leer la conversacion: ${String(err?.message ?? err).slice(0, 160)}` };
    }
  }

  async function get_conversation_messages(args, ctx) {
    if (!args?.conversationId) return { error: "Falta conversationId." };
    const limit = Math.min(Math.max(parseInt(args?.limit, 10) || 30, 1), RECENT_MAX);
    try {
      const res = await listMessages({
        conversationId: String(args.conversationId), authUserId: ctx.actorAuthUserId,
        limit, before: args?.before || null,
      });
      return { conversationId: String(args.conversationId), messages: (res.data ?? []).map(trimMessage) };
    } catch (err) {
      return { error: err?.status === 403 || err?.status === 404 ? "Sin acceso a esa conversacion." : `No se pudo leer la conversacion: ${String(err?.message ?? err).slice(0, 160)}` };
    }
  }

  async function search_my_conversations(args, ctx) {
    const q = String(args?.query ?? "").trim();
    if (!q) return { error: "Falta el texto a buscar." };
    const limit = Math.min(Math.max(parseInt(args?.limit, 10) || 15, 1), SEARCH_MAX);
    try {
      const res = await chatSearchService.searchMessages({ authUserId: ctx.actorAuthUserId, q, conversationId: null, limit, offset: 0 });
      return {
        results: (res.data ?? []).map((r) => ({
          conversationId: r.conversationId ?? r.conversation_id,
          conversationTitle: r.conversationTitle ?? r.conversation_title ?? null,
          snippet: r.snippet ?? r.body_snippet ?? "",
          senderName: r.senderName ?? r.sender_name ?? null,
          sentAt: r.createdAt ?? r.created_at ?? null,
        })),
      };
    } catch (err) {
      return { error: `No se pudo buscar: ${String(err?.message ?? err).slice(0, 160)}` };
    }
  }

  async function list_conversation_files(args, ctx) {
    const conversationId = String(args?.conversationId || ctx.conversationId);
    const limit = Math.min(Math.max(parseInt(args?.limit, 10) || 30, 1), FILES_MAX);
    try {
      await listMessages({ conversationId, authUserId: ctx.actorAuthUserId, limit: 1, before: null });
    } catch (err) {
      return { error: err?.status === 403 || err?.status === 404 ? "Sin acceso a esa conversacion." : `No se pudo acceder: ${String(err?.message ?? err).slice(0, 160)}` };
    }
    const rows = await prisma.$queryRaw`
      SELECT a.id, a.file_name, a.mime_type, a.size_bytes,
             up.display_name AS sender_name, m.created_at AS sent_at
      FROM chat_attachments a
      JOIN chat_messages m ON m.id = a.message_id
      LEFT JOIN user_profile up ON up.id = m.sender_user_id
      WHERE a.conversation_id = ${conversationId}::uuid
        AND m.deleted_at IS NULL
      ORDER BY m.created_at DESC
      LIMIT ${limit}
    `;
    return {
      files: rows.map((r) => ({
        attachmentId: r.id,
        fileName: r.file_name,
        mimeType: r.mime_type,
        sizeBytes: Number(r.size_bytes ?? 0),
        senderName: r.sender_name ?? null,
        sentAt: r.sent_at instanceof Date ? r.sent_at.toISOString() : String(r.sent_at),
      })),
    };
  }

  async function describe_image(args, ctx) {
    const attachmentId = String(args?.attachmentId ?? "").trim();
    if (!attachmentId) return { error: "Falta attachmentId." };
    const [att] = await prisma.$queryRaw`
      SELECT a.id, a.mime_type, a.object_key, a.bucket, a.conversation_id
      FROM chat_attachments a
      WHERE a.id = ${attachmentId}::uuid
      LIMIT 1
    `;
    if (!att) return { error: "No encontre ese adjunto." };
    try {
      await listMessages({ conversationId: att.conversation_id, authUserId: ctx.actorAuthUserId, limit: 1, before: null });
    } catch {
      return { error: "Sin acceso a ese adjunto." };
    }
    if (!String(att.mime_type ?? "").startsWith("image/")) {
      return { error: "Ese adjunto no es una imagen; solo puedo describir imagenes." };
    }
    try {
      const { imageBase64 } = await fetchAttachmentBase64({ signAttachmentUrl, att });
      const { description } = await visionService.describeImage({
        imageBase64, mimeType: att.mime_type, question: args?.question,
      });
      return { description };
    } catch (err) {
      return { error: `No pude analizar la imagen: ${String(err?.message ?? err).slice(0, 160)}` };
    }
  }

  async function search_atlas(args, ctx) {
    const q = String(args?.query ?? "").trim();
    if (q.length < 2) return { error: "Da al menos 2 caracteres para buscar." };
    if (typeof resolveUserContext !== "function") return { error: "La busqueda de registros no esta disponible aqui." };
    let uctx;
    try { uctx = await resolveUserContext(ctx.actorAuthUserId); } catch { uctx = null; }
    if (!uctx?.profile) return { error: "No pude verificar tus permisos." };
    const companyId = uctx.memberships?.[0]?.companyId ?? ctx.companyId ?? null;
    if (!companyId) return { error: "Sin empresa activa." };
    const allowed = SEARCH_PROVIDERS.filter((p) => uctx.isAdmin || uctx.permissionSet?.has(p.permission));
    if (!allowed.length) return { error: "No tienes permiso para buscar registros del ERP." };
    const settled = await Promise.allSettled(
      allowed.map((p) => p.run({ prisma, companyId, actorId: uctx.profile.id, q, limit: 5 })),
    );
    const groups = [];
    settled.forEach((r, i) => {
      if (r.status !== "fulfilled" || !Array.isArray(r.value) || !r.value.length) return;
      groups.push({
        tipo: allowed[i].label,
        resultados: r.value.map((it) => ({ nombre: it.title, detalle: it.subtitle ?? null })),
      });
    });
    return groups.length ? { groups } : { note: "Sin resultados en contactos, usuarios ni empleados." };
  }

  return {
    get_recent_messages, get_conversation_messages, search_my_conversations,
    list_conversation_files, describe_image, search_atlas,
  };
}

// ---------------------------------------------------------------------------
// Spec 3 — the single tool for a `@meridIAn` channel mention. No assertMember:
// the mention came from a channel member and the reply is public in that same
// channel, so reading its recent history exposes nothing the members don't see.
// ---------------------------------------------------------------------------
export const CHANNEL_TOOL_DEFS = [{
  type: "function",
  function: {
    name: "get_channel_messages",
    description: "Devuelve los mensajes recientes de ESTE canal (donde te mencionaron). Es tu unica fuente de contexto ademas de tu conocimiento general.",
    parameters: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 40, description: "Cuantos traer (max 40, por defecto 25)." },
      },
    },
  },
}];

export function buildChannelToolRunners({ prisma }) {
  async function get_channel_messages(args, ctx) {
    const limit = Math.min(Math.max(parseInt(args?.limit, 10) || 25, 1), 40);
    const rows = await prisma.$queryRaw`
      SELECT m.sender_type, m.body, m.message_type, m.created_at, m.attachment_count,
             up.display_name AS sender_name
      FROM chat_messages m
      LEFT JOIN user_profile up ON up.id = m.sender_user_id
      WHERE m.conversation_id = ${ctx.conversationId}::uuid
        AND m.deleted_at IS NULL
        AND m.thread_root_id IS NULL
      ORDER BY m.created_at DESC
      LIMIT ${limit}
    `;
    rows.reverse();
    return {
      messages: rows.map((m) => ({
        senderName: m.sender_name ?? (m.sender_type === "assistant" ? "MeridIAn" : m.sender_type === "system" ? "sistema" : "desconocido"),
        senderType: m.sender_type,
        body: String(m.body ?? "").slice(0, 2000),
        messageType: m.message_type,
        sentAt: m.created_at instanceof Date ? m.created_at.toISOString() : String(m.created_at),
        attachmentCount: m.attachment_count ?? 0,
      })),
    };
  }
  return { get_channel_messages };
}

// Download an attachment's bytes via a service-role signed URL and return
// base64. `signAttachmentUrl` is injected by meridian-service (Task 6), so this
// module never imports supabase and the non-image tests never reach here.
async function fetchAttachmentBase64({ signAttachmentUrl, att }) {
  const url = await signAttachmentUrl(att.bucket, att.object_key);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`descarga fallo (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 8 * 1024 * 1024) throw new Error("imagen demasiado grande");
  return { imageBase64: buf.toString("base64") };
}
