import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startOfficeDev } from '../start-office-dev.mjs';

const values = {
  ATLAS_OFFICE_ENABLED: 'true',
  COLLABORA_INTERNAL_URL: 'http://127.0.0.1:9980',
  COLLABORA_PUBLIC_URL: 'http://localhost:9980',
  ATLAS_WOPI_URL: 'http://host.docker.internal:4020',
  ATLAS_OFFICE_HOST_ORIGIN: 'http://localhost:5174',
  ATLAS_WOPI_SECRET: 'development-test-key-'.repeat(3),
};

test('disabled or remote Office does not start local Docker services', () => {
  const run = () => { throw new Error('Docker must not be called'); };
  assert.equal(startOfficeDev({ values: {}, run }).status, 'disabled');
  assert.equal(startOfficeDev({ values: { ...values, COLLABORA_INTERNAL_URL: 'https://office.example.com' }, run }).status, 'external');
});

test('local Office targets only its service in Atlas and derives host/origin configuration', () => {
  let calls = 0;
  const result = startOfficeDev({ values, run(command, args, options) {
    calls++;
    assert.equal(command, 'docker');
    assert.equal(args[args.indexOf('-p') + 1], 'atlaserp');
    assert.deepEqual(args.slice(args.indexOf('up')), ['up', '-d', '--no-deps', 'collabora-dev']);
    assert.equal(options.env.COLLABORA_WOPI_HOST, values.ATLAS_WOPI_URL);
    assert.ok(options.env.COLLABORA_CONTENT_SECURITY_POLICY.includes(values.ATLAS_OFFICE_HOST_ORIGIN));
    assert.ok(!args.join(' ').includes(values.ATLAS_WOPI_SECRET));
    assert.ok(!options.env.COLLABORA_EXTRA_PARAMS.includes(values.ATLAS_WOPI_SECRET));
    return { status: 0 };
  } });
  assert.equal(calls, 1);
  assert.equal(result.status, 'started');
});

test('Docker errors surface to the optional-startup warning handler', () => {
  assert.throws(() => startOfficeDev({ values, run: () => ({ status: 1 }) }), /No se pudo iniciar/);
});

test('a different local CODE port is rejected before starting an unusable service', () => {
  assert.throws(() => startOfficeDev({ values: { ...values, COLLABORA_INTERNAL_URL: 'http://localhost:9990' }, run: () => { throw new Error('unexpected Docker call'); } }), /publica http/);
});
