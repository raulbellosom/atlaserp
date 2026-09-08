// apps/desktop/src/modules/atlas.chat/lib/meridian.js
//
// Pure helpers for the MeridIAn AI assistant surfaces in atlas.chat (Spec 1).
// No React, no network — safe to unit-test with node --test.

export const MERIDIAN_NAME = "MeridIAn";
export const MERIDIAN_SUBTITLE = "Asistente de IA · solo tú ves este chat";

// Server broadcasts typing as { userId: "meridian", isTyping } on the
// conversation's presence channel — this sentinel is not a real user id.
export const MERIDIAN_TYPING_SENTINEL = "meridian";

export const MERIDIAN_EXAMPLE_PROMPTS = [
  "Resume los mensajes que reenvié aquí",
  "¿Qué archivos e imágenes he compartido en el chat esta semana?",
  "Explícame el último mensaje que me reenviaron",
];

export function isMeridianConversation(conversation) {
  return Boolean(conversation && conversation.type === "meridian");
}

export function isAssistantMessage(message) {
  return Boolean(message && message.sender_type === "assistant");
}

// Replace the typing sentinel with the display name; pass everything else
// through unchanged so real users' typing labels are untouched.
export function mapTypingNames(list) {
  return (list ?? []).map((x) => (x === MERIDIAN_TYPING_SENTINEL ? MERIDIAN_NAME : x));
}
