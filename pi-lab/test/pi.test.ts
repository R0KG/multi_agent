import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createPiFactory } from '../src/pi.js';

test('real SDK session starts without tools, discovered resources, or disk credentials', async () => {
  // Creating a session makes no inference request; this is not a valid key.
  const create = await createPiFactory('offline-test-not-a-real-key');
  const session = await create({ name: 'test', systemPrompt: 'Only this test role.', prompt: 'unused' });
  try {
    assert.deepEqual(session.getActiveToolNames(), []);
    assert.equal(session.systemPrompt, `Only this test role.\n\n<cwd>\n${process.cwd()}\n</cwd>`);
    assert.equal(session.messages.filter((message) => message.role === 'user').length, 0);
  } finally {
    session.dispose();
  }
});
