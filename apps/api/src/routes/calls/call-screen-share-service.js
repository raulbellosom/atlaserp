import { TrackSource } from 'livekit-server-sdk';

export function createCallScreenShareService({ assertEnabled, resolveProfile, getCallRecord, assertCallAccess, AccessTokenImpl, ErrorImpl }) {
  async function getScreenShareToken({ authUserId, callId }) {
    const config = assertEnabled();
    const profile = await resolveProfile(authUserId);
    const call = await getCallRecord(callId);
    const participant = await assertCallAccess(call, profile.id);
    if (!['RINGING', 'ACTIVE'].includes(call.status) || participant.status !== 'JOINED') {
      throw new ErrorImpl('Debes estar conectado a esta llamada para compartir pantalla.', 409);
    }
    const identity = `screen:${profile.id}`;
    const token = new AccessTokenImpl(config.apiKey, config.apiSecret, {
      identity, name: `${profile.displayName || 'Participante'} · Pantalla`, ttl: '1m',
      metadata: JSON.stringify({ callId: call.id, screenShareOwner: profile.id }),
    });
    token.addGrant({ room: call.livekitRoomName, roomJoin: true, canPublish: true,
      canPublishSources: [TrackSource.SCREEN_SHARE], canSubscribe: false, canPublishData: false });
    return { callId: call.id, identity, ownerIdentity: profile.id, livekitUrl: config.publicUrl, token: await token.toJwt() };
  }
  return { getScreenShareToken };
}
