import test from 'node:test';
import assert from 'node:assert/strict';
import { createConnectionTrace } from './connection-trace.js';

test('connection traces contain only timings and allowlisted lifecycle metadata', () => {
  let time = 100;
  const records = [];
  const trace = createConnectionTrace(7, { now: () => time, log: (label, raw) => records.push([label, JSON.parse(raw)]) });
  trace('opened');
  time = 125;
  trace('closed', { code: 1006, authenticated: true, durationMs: 12.7, previousState: 2,
    accessToken: 'private-token', playerId: 'private-player', reason: 'private-reason', address: '192.0.2.1' });
  trace('private-token');
  assert.deepEqual(records, [
    ['Game connection stage:', { connectionId: 7, event: 'opened', elapsedMs: 0 }],
    ['Game connection stage:', { connectionId: 7, event: 'closed', elapsedMs: 25, durationMs: 13,
      code: 1006, authenticated: true, previousState: 2 }],
  ]);
});

test('malformed metadata and failing log sinks cannot affect the connection protocol', () => {
  const records = [];
  const trace = createConnectionTrace(1, { now: () => 0, log: (_label, raw) => records.push(JSON.parse(raw)) });
  trace('closed', { code: 'secret', durationMs: Infinity, authenticated: 'secret', previousState: 99 });
  assert.deepEqual(records, [{ connectionId: 1, event: 'closed', elapsedMs: 0 }]);
  const failing = createConnectionTrace(2, { log: () => { throw new Error('Unavailable logger'); } });
  assert.doesNotThrow(() => failing('opened'));
});
