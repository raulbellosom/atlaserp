// Shared by the publisher and Settings so a displayed default is also enforced.
const IMPORTANT_EVENTS = new Set([
  'projects.member.added',
  'projects.task.assigned',
  'projects.task.mention',
  'chat.member.added',
  'chat.mention.new',
  'notes.note.shared',
  'inventory.item.mention',
]);

export function getDefaultNotificationPreference(eventType) {
  const important = IMPORTANT_EVENTS.has(eventType);
  return {
    inAppEnabled: true,
    emailEnabled: important,
    pushEnabled: important || eventType === 'chat.call.incoming',
  };
}
