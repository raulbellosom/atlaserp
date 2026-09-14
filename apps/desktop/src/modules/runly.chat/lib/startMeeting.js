// A host-only call requires a guest link before /calls is invoked.
// Keep an uncertain network failure retryable; never delete a room whose
// call may already have been accepted by the server.
export async function startMeeting({ resolveTargetId, createLink, startCall, discardNewRoom }) {
  const conversationId = await resolveTargetId();
  let callRequested = false;
  try {
    await createLink(conversationId);
    callRequested = true;
    return await startCall({ conversationId, kind: "VIDEO", throwOnError: true });
  } catch (error) {
    if (!error?.callMayExist && (!callRequested || (error?.status >= 400 && error.status < 500))) {
      try {
        await discardNewRoom(conversationId);
      } catch {
        // The caller retains the room ID, so retrying reuses it.
      }
    }
    throw error;
  }
}
