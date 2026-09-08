import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOfficeMessage } from './office-message.js';

test('Office accepts messages only from the exact editor frame and origin', () => {
  const frame = {};
  const event = { source: frame, origin: 'https://office.example.com', data: '{"MessageId":"Action_Save_Resp","Values":{"success":true}}' };
  assert.equal(parseOfficeMessage(event, frame, event.origin).Values.success, true);
  assert.equal(parseOfficeMessage(event, {}, event.origin), null);
  assert.equal(parseOfficeMessage(event, frame, 'https://evil.example.com'), null);
  assert.equal(parseOfficeMessage({ ...event, data: 'bad-json' }, frame, event.origin), null);
});
