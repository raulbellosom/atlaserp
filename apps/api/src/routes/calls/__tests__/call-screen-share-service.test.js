import test from 'node:test';
import assert from 'node:assert/strict';
import { createCallScreenShareService } from '../call-screen-share-service.js';

function fixture({ status = 'ACTIVE', participantStatus = 'JOINED', membership = true } = {}) {
  const issued = [];
  class ErrorImpl extends Error { constructor(message, status) { super(message); this.status = status; } }
  class Token {
    constructor(_key, _secret, options) { issued.push({ options }); }
    addGrant(grant) { issued.at(-1).grant = grant; }
    toJwt() { return 'test-token'; }
  }
  const service = createCallScreenShareService({
    assertEnabled: () => ({ publicUrl: 'wss://rtc.test', apiKey: 'test', apiSecret: 'test' }),
    resolveProfile: async () => ({ id: 'user-a', displayName: 'Ana' }),
    getCallRecord: async () => ({ id: 'call-a', status, livekitRoomName: 'room-a' }),
    assertCallAccess: async () => {
      if (!membership) throw new ErrorImpl('Forbidden', 403);
      return { status: participantStatus };
    },
    AccessTokenImpl: Token, ErrorImpl,
  });
  return { service, issued };
}

test('screen token grants only screen video in the authorized room, without replacing the primary identity', async () => {
  const { service, issued } = fixture();
  const result = await service.getScreenShareToken({ authUserId: 'auth', callId: 'call-a' });
  assert.equal(result.identity, 'screen:user-a');
  assert.equal(result.ownerIdentity, 'user-a');
  assert.equal(issued[0].options.ttl, '1m');
  assert.deepEqual(issued[0].grant, { room: 'room-a', roomJoin: true, canPublish: true, canPublishSources: [3], canSubscribe: false, canPublishData: false });
  assert.ok(!('apiSecret' in result));
});

test('screen token rejects nonmembers, ended calls and participants who have not joined', async () => {
  for (const options of [{ membership: false }, { status: 'ENDED' }, { participantStatus: 'RINGING' }, { participantStatus: 'LEFT' }]) {
    const { service, issued } = fixture(options);
    await assert.rejects(service.getScreenShareToken({ authUserId: 'auth', callId: 'call-a' }), (error) => [403, 409].includes(error.status));
    assert.equal(issued.length, 0);
  }
});
